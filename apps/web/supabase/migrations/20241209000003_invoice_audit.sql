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

-- Create function to log status changes
CREATE OR REPLACE FUNCTION public.log_invoice_status_change()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    test_user_id UUID := '00000000-0000-0000-0000-000000000000'::UUID;
BEGIN
    current_user_id := COALESCE(auth.uid(), (SELECT user_id FROM auth.users LIMIT 1), test_user_id);

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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS invoice_status_audit_trigger ON public.invoices;

-- Create trigger for status changes
CREATE TRIGGER invoice_status_audit_trigger
    AFTER UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.log_invoice_status_change();
