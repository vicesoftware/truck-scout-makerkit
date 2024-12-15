/*
 * -------------------------------------------------------
 * Section: Carriers Permissions
 * Add new permissions for managing carriers and factoring companies
 * -------------------------------------------------------
 */

begin;

-- Add new permissions for carriers management
alter type public.app_permissions add value if not exists 'carriers.manage';
alter type public.app_permissions add value if not exists 'factoring.manage';

commit;

begin;

-- Add the new permissions to the owner role
insert into public.role_permissions(role, permission)
values 
    ('owner', 'carriers.manage'::public.app_permissions),
    ('owner', 'factoring.manage'::public.app_permissions);

/*
 * -------------------------------------------------------
 * Section: Factoring Companies
 * Create the factoring companies table with proper RLS
 * -------------------------------------------------------
 */

create table if not exists public.factoring_companies (
    id uuid primary key default extensions.uuid_generate_v4(),
    account_id uuid references public.accounts(id) on delete cascade not null,
    name varchar(255) not null,
    contact_info jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid references auth.users,
    updated_by uuid references auth.users
);

comment on table public.factoring_companies is 'Details factoring companies used by carriers for invoice payments';
comment on column public.factoring_companies.account_id is 'The account that owns this factoring company';
comment on column public.factoring_companies.name is 'Name of the factoring company';
comment on column public.factoring_companies.contact_info is 'Contact information stored as JSONB';

-- Enable RLS
alter table public.factoring_companies enable row level security;

-- Create indexes
create index if not exists ix_factoring_companies_account_id on public.factoring_companies(account_id);

-- Grant access
grant select, insert, update, delete on table public.factoring_companies to authenticated, service_role;

-- RLS Policies following MakerKit pattern
create policy select_factoring_companies on public.factoring_companies
    for select
    to authenticated
    using (
        account_id = auth.uid() or
        public.has_role_on_account(account_id)
    );

create policy insert_factoring_companies on public.factoring_companies
    for insert
    to authenticated
    with check (
        account_id = auth.uid() or
        public.has_permission(auth.uid(), account_id, 'factoring.manage'::public.app_permissions)
    );

create policy update_factoring_companies on public.factoring_companies
    for update
    to authenticated
    using (
        account_id = auth.uid() or
        public.has_permission(auth.uid(), account_id, 'factoring.manage'::public.app_permissions)
    )
    with check (
        account_id = auth.uid() or
        public.has_permission(auth.uid(), account_id, 'factoring.manage'::public.app_permissions)
    );

create policy delete_factoring_companies on public.factoring_companies
    for delete
    to authenticated
    using (
        account_id = auth.uid() or
        public.has_permission(auth.uid(), account_id, 'factoring.manage'::public.app_permissions)
    );

/*
 * -------------------------------------------------------
 * Section: Carriers
 * Create the carriers table with proper RLS
 * -------------------------------------------------------
 */

create table if not exists public.carriers (
    id uuid primary key default extensions.uuid_generate_v4(),
    account_id uuid references public.accounts(id) on delete cascade not null,
    name varchar(255) not null,
    mc_number varchar(50),
    contact_info jsonb not null default '{}'::jsonb,
    rating decimal(3,2) check (rating >= 0 and rating <= 5),
    preferred_status boolean default false,
    factoring_company_id uuid references public.factoring_companies(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid references auth.users,
    updated_by uuid references auth.users
);

comment on table public.carriers is 'Represents trucking carriers and their details';
comment on column public.carriers.account_id is 'The account that owns this carrier';
comment on column public.carriers.name is 'Name of the carrier';
comment on column public.carriers.mc_number is 'Motor Carrier number';
comment on column public.carriers.contact_info is 'Contact information stored as JSONB';
comment on column public.carriers.rating is 'Carrier rating from 0 to 5';
comment on column public.carriers.preferred_status is 'Whether this is a preferred carrier';
comment on column public.carriers.factoring_company_id is 'Associated factoring company if any';

-- Enable RLS
alter table public.carriers enable row level security;

-- Create indexes
create index if not exists ix_carriers_account_id on public.carriers(account_id);
create index if not exists ix_carriers_factoring_company_id on public.carriers(factoring_company_id);
create index if not exists ix_carriers_mc_number on public.carriers(mc_number);

-- Grant access
grant select, insert, update, delete on table public.carriers to authenticated, service_role;

-- RLS Policies following MakerKit pattern
create policy select_carriers on public.carriers
    for select
    to authenticated
    using (
        account_id = auth.uid() or
        public.has_role_on_account(account_id)
    );

create policy insert_carriers on public.carriers
    for insert
    to authenticated
    with check (
        account_id = auth.uid() or
        public.has_permission(auth.uid(), account_id, 'carriers.manage'::public.app_permissions)
    );

create policy update_carriers on public.carriers
    for update
    to authenticated
    using (
        account_id = auth.uid() or
        public.has_permission(auth.uid(), account_id, 'carriers.manage'::public.app_permissions)
    )
    with check (
        account_id = auth.uid() or
        public.has_permission(auth.uid(), account_id, 'carriers.manage'::public.app_permissions)
    );

create policy delete_carriers on public.carriers
    for delete
    to authenticated
    using (
        account_id = auth.uid() or
        public.has_permission(auth.uid(), account_id, 'carriers.manage'::public.app_permissions)
    );

-- Add triggers for timestamps
create trigger set_timestamp
    before insert or update on public.carriers
    for each row
    execute procedure public.trigger_set_timestamps();

create trigger set_timestamp
    before insert or update on public.factoring_companies
    for each row
    execute procedure public.trigger_set_timestamps();

-- Add triggers for user tracking
create trigger set_user_tracking
    before insert or update on public.carriers
    for each row
    execute procedure public.trigger_set_user_tracking();

create trigger set_user_tracking
    before insert or update on public.factoring_companies
    for each row
    execute procedure public.trigger_set_user_tracking();

commit;
