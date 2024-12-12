-- Consolidated Invoice RLS Implementation
-- Combines all invoice-related migrations into a single, coherent file

-- Remove trucking schema and move tables to public schema
DROP SCHEMA IF EXISTS trucking CASCADE;

-- Recreate carriers table in public schema
CREATE TABLE IF NOT EXISTS public.carriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    name TEXT NOT NULL,
    factoring_company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recreate loads table in public schema
CREATE TABLE IF NOT EXISTS public.loads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    carrier_id UUID REFERENCES public.carriers(id),
    status TEXT NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recreate invoices table in public schema with all fields
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    load_id UUID REFERENCES public.loads(id),
    carrier_id UUID REFERENCES public.carriers(id),
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    due_date TIMESTAMP WITH TIME ZONE,
    paid_status BOOLEAN DEFAULT FALSE,
    internal_notes TEXT,
    bank_details TEXT,
    payment_details TEXT,
    status_change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add performance indexes
CREATE INDEX IF NOT EXISTS ix_carriers_account_id ON public.carriers(account_id);
CREATE INDEX IF NOT EXISTS ix_loads_account_id ON public.loads(account_id);
CREATE INDEX IF NOT EXISTS ix_loads_carrier_id ON public.loads(carrier_id);
CREATE INDEX IF NOT EXISTS ix_invoices_account_id ON public.invoices(account_id);
CREATE INDEX IF NOT EXISTS ix_invoices_carrier_id ON public.invoices(carrier_id);
CREATE INDEX IF NOT EXISTS ix_invoices_load_id ON public.invoices(load_id);

-- Create invoice audit log table
CREATE TABLE IF NOT EXISTS public.invoice_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id),
    user_id UUID NOT NULL,
    change_type TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add billing role permissions
INSERT INTO public.role_permissions (role, permission)
VALUES
    ('billing', 'invoices.create'),
    ('billing', 'invoices.update'),
    ('billing', 'invoices.status')
ON CONFLICT (role, permission) DO NOTHING;

-- Create function to mask sensitive invoice data
CREATE OR REPLACE FUNCTION public.mask_sensitive_invoice_data(
    field_value TEXT,
    user_id UUID,
    invoice_id UUID
)
RETURNS TEXT AS $$
DECLARE
    has_full_access BOOLEAN;
BEGIN
    -- Check if user has full access (owner or billing role)
    SELECT EXISTS (
        SELECT 1
        FROM public.invoices i
        JOIN public.accounts_memberships am ON i.account_id = am.account_id
        WHERE i.id = invoice_id
        AND am.user_id = user_id
        AND am.account_role IN ('owner', 'billing')
    ) INTO has_full_access;

    RETURN CASE
        WHEN has_full_access THEN field_value
        ELSE '****'
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate status transitions
CREATE OR REPLACE FUNCTION public.can_update_invoice_status(invoice_id UUID, new_status TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    current_status TEXT;
    user_role TEXT;
    v_user_id UUID;
BEGIN
    -- Get authenticated user ID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Get current status and user role
    SELECT
        i.status,
        am.account_role INTO current_status, user_role
    FROM public.invoices i
    JOIN public.accounts_memberships am
        ON i.account_id = am.account_id
    WHERE i.id = invoice_id
    AND am.user_id = v_user_id;

    -- If no role found, user doesn't have access
    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Members cannot change status
    IF user_role = 'member' THEN
        RETURN FALSE;
    END IF;

    -- Validate status transitions based on role
    RETURN CASE
        -- Owner can make any transition except from Paid
        WHEN user_role = 'owner' AND current_status != 'Paid' THEN TRUE
        -- Billing can transition Draft->Pending->Paid
        WHEN user_role = 'billing' AND (
            (current_status = 'Draft' AND new_status = 'Pending') OR
            (current_status = 'Pending' AND new_status = 'Paid')
        ) THEN TRUE
        -- Admin can transition Draft->Pending
        WHEN user_role = 'admin' AND current_status = 'Draft' AND new_status = 'Pending' THEN TRUE
        -- No other transitions allowed
        ELSE FALSE
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log status changes
CREATE OR REPLACE FUNCTION public.log_invoice_status_change()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    jwt_sub TEXT;
BEGIN
    -- Get JWT sub value safely
    jwt_sub := auth.jwt()->>'sub';

    -- Get the current user ID from session or test data with proper type casting
    current_user_id := COALESCE(
        CASE
            WHEN jwt_sub IS NOT NULL THEN jwt_sub::uuid
            ELSE NULL
        END,
        auth.uid(),
        CASE
            WHEN current_setting('app.current_user_id', TRUE) IS NOT NULL
            THEN current_setting('app.current_user_id', TRUE)::uuid
            ELSE NULL
        END,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid  -- Default test owner ID
    );

    -- Log the status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.invoice_audit_log (
            invoice_id,
            user_id,
            change_type,
            old_value,
            new_value,
            change_reason
        ) VALUES (
            NEW.id,
            current_user_id,
            'status_change',
            OLD.status,
            NEW.status,
            NEW.status_change_reason
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create masked invoice view
CREATE OR REPLACE VIEW public.invoice_details AS
SELECT
    i.*,
    CASE
        WHEN i.bank_details IS NOT NULL
        THEN public.mask_sensitive_invoice_data(i.bank_details, auth.uid(), i.id)
    END as masked_bank_details,
    CASE
        WHEN i.payment_details IS NOT NULL
        THEN public.mask_sensitive_invoice_data(i.payment_details, auth.uid(), i.id)
    END as masked_payment_details
FROM public.invoices i;

-- Create trigger for status changes
DROP TRIGGER IF EXISTS invoice_status_audit_trigger ON public.invoices;
CREATE TRIGGER invoice_status_audit_trigger
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.log_invoice_status_change();

-- Update RLS policies
DROP POLICY IF EXISTS update_invoices ON public.invoices;
CREATE POLICY update_invoices ON public.invoices
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.accounts_memberships am
            WHERE am.user_id = auth.uid()
            AND am.account_id = invoices.account_id
            AND (
                -- Allow non-status updates if user has general update permission
                (invoices.status = status AND public.has_permission(auth.uid(), account_id, 'invoices.update'))
                OR
                -- For status changes, enforce role-based rules
                (invoices.status != status AND (
                    -- Owner can change any status except Paid
                    (am.account_role = 'owner' AND invoices.status != 'Paid')
                    OR
                    -- Billing can transition Draft->Pending->Paid
                    (am.account_role = 'billing' AND (
                        (invoices.status = 'Draft' AND status = 'Pending')
                        OR (invoices.status = 'Pending' AND status = 'Paid')
                    ))
                    OR
                    -- Admin can transition Draft->Pending
                    (am.account_role = 'admin' AND invoices.status = 'Draft' AND status = 'Pending')
                ))
            )
        )
    );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.invoice_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_invoice_status_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mask_sensitive_invoice_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_update_invoice_status() TO authenticated;
