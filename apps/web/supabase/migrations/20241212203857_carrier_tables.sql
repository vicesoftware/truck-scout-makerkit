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

ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY carriers_read ON public.carriers
    FOR SELECT TO authenticated
    USING (
        account_id IN (
            SELECT id FROM public.accounts
            WHERE public.has_role_on_account(id)
        )
    );

CREATE POLICY carriers_insert ON public.carriers
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_permission(
            auth.uid(),
            account_id,
            'carriers.manage'::public.app_permissions
        )
    );

CREATE POLICY carriers_update ON public.carriers
    FOR UPDATE TO authenticated
    USING (
        public.has_permission(
            auth.uid(),
            account_id,
            'carriers.manage'::public.app_permissions
        )
    )
    WITH CHECK (
        public.has_permission(
            auth.uid(),
            account_id,
            'carriers.manage'::public.app_permissions
        )
    );

CREATE POLICY carriers_delete ON public.carriers
    FOR DELETE TO authenticated
    USING (
        public.has_permission(
            auth.uid(),
            account_id,
            'carriers.manage'::public.app_permissions
        )
    );

GRANT ALL ON public.carriers TO authenticated;
GRANT ALL ON public.carriers TO service_role;

ALTER TYPE public.app_permissions ADD VALUE IF NOT EXISTS 'carriers.manage';

INSERT INTO public.role_permissions (role, permission)
VALUES
    ('owner', 'carriers.manage'),
    ('admin', 'carriers.manage')
ON CONFLICT (role, permission) DO NOTHING;
