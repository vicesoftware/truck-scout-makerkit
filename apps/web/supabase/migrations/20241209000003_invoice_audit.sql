-- Create invoice audit log table
CREATE TABLE IF NOT EXISTS trucking.invoice_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES trucking.invoices(id),
    user_id UUID,
    change_type TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create function to log status changes
CREATE OR REPLACE FUNCTION trucking.log_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO trucking.invoice_audit_log (
            invoice_id,
            user_id,
            change_type,
            old_value,
            new_value,
            change_reason
        ) VALUES (
            NEW.id,
            auth.uid(),
            'status_change',
            OLD.status,
            NEW.status,
            NEW.status_change_reason
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for status changes
CREATE TRIGGER invoice_status_audit_trigger
    BEFORE UPDATE ON trucking.invoices
    FOR EACH ROW
    EXECUTE FUNCTION trucking.log_invoice_status_change();
