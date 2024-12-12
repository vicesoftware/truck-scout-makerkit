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
        FROM trucking.invoices i
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

-- Add masking to invoice view
CREATE OR REPLACE VIEW trucking.invoice_details AS
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
FROM trucking.invoices i;
