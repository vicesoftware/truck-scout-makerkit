-- Remove trucking schema and move tables to public schema
DROP SCHEMA IF EXISTS trucking CASCADE;

-- Recreate carriers table in public schema
CREATE TABLE public.carriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    name TEXT NOT NULL,
    factoring_company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recreate loads table in public schema
CREATE TABLE public.loads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    carrier_id UUID REFERENCES public.carriers(id),
    status TEXT NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recreate invoices table in public schema
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id),
    load_id UUID REFERENCES public.loads(id),
    carrier_id UUID REFERENCES public.carriers(id),
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    due_date TIMESTAMP WITH TIME ZONE,
    paid_status BOOLEAN DEFAULT FALSE,
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS ix_carriers_account_id ON public.carriers(account_id);
CREATE INDEX IF NOT EXISTS ix_loads_account_id ON public.loads(account_id);
CREATE INDEX IF NOT EXISTS ix_loads_carrier_id ON public.loads(carrier_id);
CREATE INDEX IF NOT EXISTS ix_invoices_account_id ON public.invoices(account_id);
CREATE INDEX IF NOT EXISTS ix_invoices_carrier_id ON public.invoices(carrier_id);
CREATE INDEX IF NOT EXISTS ix_invoices_load_id ON public.invoices(load_id);

-- Add RPC function to retrieve invoices 
CREATE OR REPLACE FUNCTION get_invoices_from_trucking_schema()
RETURNS TABLE (
    id UUID,
    account_id UUID,
    load_id UUID,
    carrier_id UUID,
    amount NUMERIC,
    due_date TIMESTAMP WITH TIME ZONE,
    paid_status BOOLEAN,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        id, 
        account_id, 
        load_id, 
        carrier_id, 
        amount, 
        due_date, 
        paid_status, 
        status, 
        created_at, 
        updated_at
    FROM public.invoices
    LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION get_invoices_from_trucking_schema() TO service_role;

