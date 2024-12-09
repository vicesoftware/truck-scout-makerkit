-- Create trucking schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS trucking;

-- Create audit_logs table for tracking changes
CREATE TABLE IF NOT EXISTS trucking.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    user_id UUID,  -- Make user_id nullable for system operations
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create carriers table first (since it's referenced by loads and invoices)
CREATE TABLE IF NOT EXISTS trucking.carriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    name TEXT NOT NULL,
    factoring_company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create loads table (since it's referenced by invoices)
CREATE TABLE IF NOT EXISTS trucking.loads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    carrier_id UUID REFERENCES trucking.carriers(id),
    status TEXT NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS trucking.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    load_id UUID REFERENCES trucking.loads(id),
    carrier_id UUID REFERENCES trucking.carriers(id),
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    due_date TIMESTAMP WITH TIME ZONE,
    paid_status BOOLEAN DEFAULT FALSE,
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE trucking.carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucking.loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucking.invoices ENABLE ROW LEVEL SECURITY;

-- Create required indexes for performance
CREATE INDEX IF NOT EXISTS ix_carriers_account_id ON trucking.carriers(account_id);
CREATE INDEX IF NOT EXISTS ix_loads_account_id ON trucking.loads(account_id);
CREATE INDEX IF NOT EXISTS ix_loads_carrier_id ON trucking.loads(carrier_id);
CREATE INDEX IF NOT EXISTS ix_invoices_account_id ON trucking.invoices(account_id);
CREATE INDEX IF NOT EXISTS ix_invoices_carrier_id ON trucking.invoices(carrier_id);
CREATE INDEX IF NOT EXISTS ix_invoices_load_id ON trucking.invoices(load_id);

-- Core RLS Functions

-- Function to check if user is a factoring company for an invoice
CREATE OR REPLACE FUNCTION public.is_factoring_company_for_invoice(invoice_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM trucking.invoices i
        JOIN trucking.carriers c ON i.carrier_id = c.id
        WHERE i.id = invoice_id
        AND c.factoring_company_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate invoice status transitions
CREATE OR REPLACE FUNCTION public.can_update_invoice_status(invoice_id UUID, new_status TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    current_status TEXT;
    user_has_permission BOOLEAN;
BEGIN
    -- Get current status and check permissions
    SELECT 
        i.status,
        public.has_permission(auth.uid(), i.account_id, 'invoices.status') INTO current_status, user_has_permission
    FROM trucking.invoices i
    WHERE i.id = invoice_id;

    -- Must have permission to update status
    IF NOT user_has_permission THEN
        RETURN FALSE;
    END IF;

    -- Validate status transitions
    RETURN CASE
        WHEN current_status = 'Draft' AND new_status IN ('Pending', 'Void') THEN TRUE
        WHEN current_status = 'Pending' AND new_status IN ('Paid', 'Void') THEN TRUE
        WHEN current_status = 'Paid' THEN FALSE -- Paid invoices cannot be modified
        ELSE FALSE
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if invoice can be modified
CREATE OR REPLACE FUNCTION public.can_modify_invoice(invoice_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    invoice_status TEXT;
BEGIN
    SELECT status INTO invoice_status
    FROM trucking.invoices
    WHERE id = invoice_id;

    -- Paid invoices cannot be modified
    IF invoice_status = 'Paid' THEN
        RETURN FALSE;
    END IF;

    -- Check if user has update permission
    RETURN EXISTS (
        SELECT 1
        FROM trucking.invoices i
        WHERE i.id = invoice_id
        AND public.has_permission(auth.uid(), i.account_id, 'invoices.update')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies

-- SELECT policy: Allow access to account members and associated factoring companies
CREATE POLICY select_invoices ON trucking.invoices
    FOR SELECT
    TO authenticated
    USING (
        public.has_role_on_account(account_id)
        OR
        public.is_factoring_company_for_invoice(id)
    );

-- INSERT policy: Allow creation by account members with proper permissions
CREATE POLICY insert_invoices ON trucking.invoices
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_role_on_account(account_id)
        AND
        public.has_permission(auth.uid(), account_id, 'invoices.create')
    );

-- UPDATE policy: Restrict updates based on status and permissions
CREATE POLICY update_invoices ON trucking.invoices
    FOR UPDATE
    TO authenticated
    USING (
        public.can_modify_invoice(id)
    )
    WITH CHECK (
        public.can_modify_invoice(id)
    );

-- DELETE policy: Allow deletion only by users with delete permission
CREATE POLICY delete_invoices ON trucking.invoices
    FOR DELETE
    TO authenticated
    USING (
        public.has_permission(auth.uid(), account_id, 'invoices.delete')
    );

-- Basic RLS policies for carriers and loads

-- Carriers policies
CREATE POLICY select_carriers ON trucking.carriers
    FOR SELECT TO authenticated
    USING (public.has_role_on_account(account_id));

CREATE POLICY insert_carriers ON trucking.carriers
    FOR INSERT TO authenticated
    WITH CHECK (public.has_role_on_account(account_id));

CREATE POLICY update_carriers ON trucking.carriers
    FOR UPDATE TO authenticated
    USING (public.has_role_on_account(account_id));

CREATE POLICY delete_carriers ON trucking.carriers
    FOR DELETE TO authenticated
    USING (public.has_role_on_account(account_id));

-- Loads policies
CREATE POLICY select_loads ON trucking.loads
    FOR SELECT TO authenticated
    USING (public.has_role_on_account(account_id));

CREATE POLICY insert_loads ON trucking.loads
    FOR INSERT TO authenticated
    WITH CHECK (public.has_role_on_account(account_id));

CREATE POLICY update_loads ON trucking.loads
    FOR UPDATE TO authenticated
    USING (public.has_role_on_account(account_id));

CREATE POLICY delete_loads ON trucking.loads
    FOR DELETE TO authenticated
    USING (public.has_role_on_account(account_id));

-- Create audit logging function for invoice changes
CREATE OR REPLACE FUNCTION trucking.log_invoice_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO trucking.audit_logs (
        table_name,
        record_id,
        user_id,
        action,
        old_data,
        new_data
    ) VALUES (
        TG_TABLE_NAME,
        NEW.id,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), -- Use a system user UUID for migrations
        TG_OP,
        row_to_json(OLD),
        row_to_json(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for invoice audit logging
DROP TRIGGER IF EXISTS invoice_audit_trigger ON trucking.invoices;
CREATE TRIGGER invoice_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON trucking.invoices
    FOR EACH ROW
    EXECUTE FUNCTION trucking.log_invoice_change();
