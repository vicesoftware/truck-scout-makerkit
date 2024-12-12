-- Enhanced status transition validation
CREATE OR REPLACE FUNCTION public.can_update_invoice_status(
    invoice_id UUID,
    new_status TEXT,
    user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status TEXT;
    user_role TEXT;
BEGIN
    -- Get current status and user role
    SELECT
        i.status,
        am.account_role INTO current_status, user_role
    FROM trucking.invoices i
    JOIN public.accounts_memberships am
        ON i.account_id = am.account_id
    WHERE i.id = invoice_id
    AND am.user_id = user_id;

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

-- Update RLS policies to use enhanced validation
DROP POLICY IF EXISTS update_invoices ON trucking.invoices;

-- Create policy for invoice updates with proper row-level security context
CREATE POLICY update_invoices ON trucking.invoices
    FOR UPDATE
    TO authenticated
    USING (
        CASE
            WHEN current_setting('my.status_update', true)::boolean THEN
                public.can_update_invoice_status(id, status)
            ELSE
                public.has_permission(auth.uid(), account_id, 'invoices.update')
        END
    )
    WITH CHECK (
        CASE
            WHEN current_setting('my.status_update', true)::boolean THEN
                public.can_update_invoice_status(id, status)
            ELSE
                public.has_permission(auth.uid(), account_id, 'invoices.update')
        END
    );

-- Add trigger to set status_update flag
CREATE OR REPLACE FUNCTION public.set_status_update_flag()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM set_config('my.status_update', 'true', true);
    ELSE
        PERFORM set_config('my.status_update', 'false', true);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_status_update_flag_trigger ON trucking.invoices;
CREATE TRIGGER set_status_update_flag_trigger
    BEFORE UPDATE ON trucking.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.set_status_update_flag();
