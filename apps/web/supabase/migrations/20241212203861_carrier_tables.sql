-- Create factoring companies table
CREATE TABLE public.factoring_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_factoring_companies_account ON public.factoring_companies(account_id);

GRANT ALL ON public.factoring_companies TO authenticated;
GRANT ALL ON public.factoring_companies TO service_role;

-- Create carriers table
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

-- Update member role to hierarchy_level 3
UPDATE public.roles SET hierarchy_level = 3 WHERE name = 'member';

-- Add admin role with hierarchy_level 2 (between owner and member)
INSERT INTO public.roles (name, hierarchy_level)
VALUES ('admin', 2)
ON CONFLICT (name) DO NOTHING;

-- Insert role permissions
INSERT INTO public.role_permissions (role, permission)
VALUES
    ('owner', 'carriers.manage'),
    ('admin', 'carriers.manage'),
    ('owner', 'factoring_companies.manage'),
    ('admin', 'factoring_companies.manage')
ON CONFLICT (role, permission) DO NOTHING;
