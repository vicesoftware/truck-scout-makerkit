# Schema Merge Analysis

## MakerKit's Core Design Pattern

The MakerKit schema uses `public.accounts` as the central entity, where:
- Everything is owned by an account
- Accounts can be personal (user) or team-based
- Memberships control access to accounts
- Billing and subscriptions tie to accounts

We should follow this pattern when adding our trucking-specific tables.

## Schema Integration Strategy

### Core Entity Relationship

```
accounts
  ↓
  ├── factoring_companies
  ├── carriers
  ├── loads
  ├── invoices
  └── contacts
```

All new tables should relate to `accounts` to maintain the multi-tenant architecture.

### Existing Tables to Keep (MakerKit)

1. Account Management:
   - `public.accounts`: Central entity
   - `public.accounts_memberships`: Team membership
   - `public.roles` & `public.role_permissions`: Access control
   - `public.invitations`: Team invites

2. Billing:
   - `public.billing_customers`
   - `public.subscriptions`
   - `public.subscription_items`
   - `public.orders`
   - `public.order_items`

3. Notifications:
   - `public.notifications`

### New Tables Needed (Trucking-Specific)

```sql
CREATE TABLE public.factoring_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_info JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.carriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    mc_number VARCHAR(50),
    contact_info JSONB,
    rating DECIMAL(3, 2),
    preferred_status BOOLEAN DEFAULT FALSE,
    factoring_company_id UUID REFERENCES public.factoring_companies(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.loads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    origin VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    pickup_date TIMESTAMPTZ,
    delivery_date TIMESTAMPTZ,
    status VARCHAR(50),
    carrier_id UUID REFERENCES public.carriers(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    load_id UUID REFERENCES public.loads(id),
    carrier_id UUID REFERENCES public.carriers(id),
    amount DECIMAL(10, 2),
    due_date TIMESTAMPTZ,
    paid_status BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    role VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.accounting_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id),
    load_id UUID REFERENCES public.loads(id),
    entry_type VARCHAR(50) NOT NULL, -- 'receivable' or 'payable'
    amount DECIMAL(10, 2) NOT NULL,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Key Changes from Original Design

1. **Account Integration**
   - Added `account_id` to all tables
   - Removed separate `Brokers` table (using `accounts` instead)
   - Added CASCADE deletion for account relationships

2. **Authentication**
   - Using Supabase Auth (`auth.users`)
   - Profile data stored in `accounts`
   - Removed redundant auth tables

3. **Access Control**
   - Using MakerKit's role/permission system
   - Will add trucking-specific permissions to enum

### RLS Policies

For each new table, we'll need policies similar to:

```sql
-- Example for factoring_companies
ALTER TABLE public.factoring_companies ENABLE ROW LEVEL SECURITY;

-- Read policy
CREATE POLICY "Users can view their own factoring companies"
ON public.factoring_companies FOR SELECT
USING (auth.uid() IN (
    SELECT user_id FROM public.accounts_memberships
    WHERE account_id = factoring_companies.account_id
));

-- Insert policy
CREATE POLICY "Users can create factoring companies"
ON public.factoring_companies FOR INSERT
WITH CHECK (auth.uid() IN (
    SELECT user_id FROM public.accounts_memberships
    WHERE account_id = factoring_companies.account_id
));

-- Similar policies needed for UPDATE and DELETE
```

### Indexes

```sql
-- Factoring Companies
CREATE INDEX idx_factoring_companies_account ON public.factoring_companies(account_id);

-- Carriers
CREATE INDEX idx_carriers_account ON public.carriers(account_id);
CREATE INDEX idx_carriers_factoring_company ON public.carriers(factoring_company_id);
CREATE INDEX idx_carriers_mc_number ON public.carriers(mc_number);

-- Loads
CREATE INDEX idx_loads_account ON public.loads(account_id);
CREATE INDEX idx_loads_carrier ON public.loads(carrier_id);
CREATE INDEX idx_loads_status ON public.loads(status);
CREATE INDEX idx_loads_dates ON public.loads(pickup_date, delivery_date);

-- Invoices
CREATE INDEX idx_invoices_account ON public.invoices(account_id);
CREATE INDEX idx_invoices_load ON public.invoices(load_id);
CREATE INDEX idx_invoices_carrier ON public.invoices(carrier_id);
CREATE INDEX idx_invoices_paid_status ON public.invoices(paid_status);

-- Contacts
CREATE INDEX idx_contacts_account ON public.contacts(account_id);
CREATE INDEX idx_contacts_email ON public.contacts(email);

-- Accounting Entries
CREATE INDEX idx_accounting_entries_account ON public.accounting_entries(account_id);
CREATE INDEX idx_accounting_entries_type ON public.accounting_entries(entry_type);
CREATE INDEX idx_accounting_entries_due_date ON public.accounting_entries(due_date);
```

### Next Steps

1. Create migration file with:
   - New table definitions
   - Indexes
   - RLS policies
   - New permissions in app_permissions enum

2. Update application code to:
   - Use account_id in all queries
   - Implement proper RLS checks
   - Add new permission checks

3. Create database functions for common operations:
   - Creating loads with associated invoices
   - Managing accounting entries
   - Carrier rating calculations
