-- Enhanced status transition validation
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

-- Update RLS policies to use enhanced validation
DROP POLICY IF EXISTS update_invoices ON public.invoices;

-- Create policy for invoice updates with proper row-level security context
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
