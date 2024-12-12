CREATE TABLE public.carriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    mc_number VARCHAR(50) NOT NULL,
    contact_info JSONB,
    rating DECIMAL(3,2),
    preferred_status BOOLEAN DEFAULT false,
    factoring_company_id UUID REFERENCES public.factoring_companies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_carriers_account ON public.carriers(account_id);
CREATE INDEX idx_carriers_factoring_company ON public.carriers(factoring_company_id);
CREATE INDEX idx_carriers_mc_number ON public.carriers(mc_number);

GRANT ALL ON public.carriers TO authenticated;
GRANT ALL ON public.carriers TO service_role;

ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'carriers.manage';

INSERT INTO public.role_permissions (role, permission)
VALUES
    ('owner', 'carriers.manage'),
    ('admin', 'carriers.manage')
ON CONFLICT (role, permission) DO NOTHING;
