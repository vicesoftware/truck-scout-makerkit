-- Ensure required extensions and schemas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set search path to ensure proper schema context
SET search_path = public, auth;

-- Create authenticated role first if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
END $$;

-- Verify auth schema exists (required for RLS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        RAISE EXCEPTION 'Auth schema must exist before running these migrations';
    END IF;
END $$;

-- Verify accounts table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts') THEN
        RAISE EXCEPTION 'Accounts table must exist before running these migrations';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts_memberships') THEN
        RAISE EXCEPTION 'Accounts memberships table must exist before running these migrations';
    END IF;
END $$;

BEGIN;

-- Grant schema usage to authenticated role early
GRANT USAGE ON SCHEMA public TO authenticated;

-- Remove trucking schema and move tables to public schema
DROP SCHEMA IF EXISTS trucking CASCADE;

-- Create base tables first
CREATE TABLE IF NOT EXISTS public.carriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    name TEXT NOT NULL,
    contact_info JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_carriers_account
        FOREIGN KEY (account_id)
        REFERENCES public.accounts(id)
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.loads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    carrier_id UUID,
    load_number TEXT NOT NULL DEFAULT 'L-' || gen_random_uuid(),
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_loads_account
        FOREIGN KEY (account_id)
        REFERENCES public.accounts(id)
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_loads_carrier
        FOREIGN KEY (carrier_id)
        REFERENCES public.carriers(id)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    load_id UUID,
    carrier_id UUID,
    invoice_number TEXT NOT NULL,
    amount DECIMAL(10,2),
    status TEXT DEFAULT 'draft',
    paid_status BOOLEAN DEFAULT false,
    due_date TIMESTAMPTZ,
    bank_details TEXT,
    payment_details TEXT,
    internal_notes TEXT,
    status_change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users,
    updated_by UUID REFERENCES auth.users,
    CONSTRAINT fk_invoices_account
        FOREIGN KEY (account_id)
        REFERENCES public.accounts(id)
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_invoices_load
        FOREIGN KEY (load_id)
        REFERENCES public.loads(id)
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_invoices_carrier
        FOREIGN KEY (carrier_id)
        REFERENCES public.carriers(id)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.invoice_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_invoice_audit_log_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES public.invoices(id)
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_account_id ON public.invoices(account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_load_id ON public.invoices(load_id);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_log_invoice_id ON public.invoice_audit_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_carriers_account_id ON public.carriers(account_id);
CREATE INDEX IF NOT EXISTS idx_loads_account_id ON public.loads(account_id);

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
CREATE OR REPLACE FUNCTION public.can_update_invoice_status(
    invoice_id UUID,
    new_status TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status TEXT;
    user_role TEXT;
BEGIN
    -- Get current status
    SELECT status INTO current_status
    FROM public.invoices
    WHERE id = invoice_id;

    -- Get user role
    SELECT account_role INTO user_role
    FROM public.accounts_memberships am
    JOIN public.invoices i ON i.account_id = am.account_id
    WHERE i.id = invoice_id
    AND am.user_id = auth.uid();

    -- Validate status transition
    RETURN (
        (user_role = 'owner') OR
        (user_role = 'billing' AND new_status = 'paid') OR
        (user_role = 'member' AND FALSE)  -- Members cannot change status
    ) AND (
        (current_status = 'draft' AND new_status = 'pending') OR
        (current_status = 'pending' AND new_status = 'paid') OR
        (current_status = current_status AND new_status = current_status)  -- Allow "updating" to same status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log invoice status changes
CREATE OR REPLACE FUNCTION public.log_invoice_status_change()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Get the current user ID from the auth.uid() function
    current_user_id := auth.uid();

    -- If no user ID is available, use the system user ID or raise an exception
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required for status changes';
    END IF;

    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.invoice_audit_log (
            invoice_id,
            user_id,
            action_type,
            old_value,
            new_value,
            reason,
            created_at
        ) VALUES (
            NEW.id,
            current_user_id,
            'status_change',
            OLD.status,
            NEW.status,
            NEW.status_change_reason,
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions before they are used in views or triggers
GRANT EXECUTE ON FUNCTION public.mask_sensitive_invoice_data(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_update_invoice_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_invoice_status_change() TO authenticated;

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

-- Create triggers
DROP TRIGGER IF EXISTS log_invoice_status_changes ON public.invoices;
CREATE TRIGGER log_invoice_status_changes
    AFTER UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.log_invoice_status_change();

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS invoice_account_access ON public.invoices;
CREATE POLICY invoice_account_access ON public.invoices
    FOR ALL
    TO authenticated
    USING (account_id IN (
        SELECT account_id
        FROM public.accounts_memberships
        WHERE user_id = auth.uid()
    ));

DROP POLICY IF EXISTS invoice_audit_access ON public.invoice_audit_log;
CREATE POLICY invoice_audit_access ON public.invoice_audit_log
    FOR ALL
    TO authenticated
    USING (invoice_id IN (
        SELECT id
        FROM public.invoices
        WHERE account_id IN (
            SELECT account_id
            FROM public.accounts_memberships
            WHERE user_id = auth.uid()
        )
    ));

-- Grant remaining permissions
GRANT ALL ON public.invoices TO authenticated;
GRANT ALL ON public.invoice_audit_log TO authenticated;
GRANT ALL ON public.invoice_details TO authenticated;

COMMIT;
