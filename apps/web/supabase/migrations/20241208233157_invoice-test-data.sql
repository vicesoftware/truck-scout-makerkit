-- Test Data for Invoice System Validation

-- Add admin role
INSERT INTO public.roles (name, hierarchy_level)
VALUES ('admin', 5);

-- Test Users (using auth.users for authentication)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner@test.com', crypt('password123', gen_salt('bf')), now(), now(), now()),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin@test.com', crypt('password123', gen_salt('bf')), now(), now(), now()),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'member@test.com', crypt('password123', gen_salt('bf')), now(), now(), now()),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'factoring@test.com', crypt('password123', gen_salt('bf')), now(), now(), now());

-- Test Accounts
INSERT INTO public.accounts (id, name, is_personal_account, primary_owner_user_id)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Test Account 1', false, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    ('22222222-2222-2222-2222-222222222222', 'Test Account 2', false, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Account Memberships
INSERT INTO public.accounts_memberships (user_id, account_id, account_role)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'admin'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'member'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'owner');

-- Test Carriers
INSERT INTO trucking.carriers (id, account_id, name, factoring_company_id)
VALUES
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Test Carrier 1', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
    ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Test Carrier 2', NULL),
    ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'Test Carrier 3', 'dddddddd-dddd-dddd-dddd-dddddddddddd');

-- Test Loads
INSERT INTO trucking.loads (id, account_id, carrier_id, status)
VALUES
    ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Active'),
    ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'Active'),
    ('88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 'Active');

-- Test Invoices (in various states)
INSERT INTO trucking.invoices (id, account_id, load_id, carrier_id, amount, status, due_date, paid_status)
VALUES
    -- Account 1 Invoices
    ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 1000.00, 'Draft', now() + interval '30 days', false),
    ('aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '44444444-4444-4444-4444-444444444444', 2000.00, 'Pending', now() + interval '30 days', false),
    ('bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 3000.00, 'Paid', now() - interval '1 day', true),

    -- Account 2 Invoices
    ('cccccccc-0000-0000-0000-cccccccccccc', '22222222-2222-2222-2222-222222222222', '88888888-8888-8888-8888-888888888888', '55555555-5555-5555-5555-555555555555', 4000.00, 'Pending', now() + interval '30 days', false);

-- Grant necessary permissions to test users
INSERT INTO public.role_permissions (role, permission)
VALUES
    -- Owner has all permissions
    ('owner', 'invoices.create'),
    ('owner', 'invoices.update'),
    ('owner', 'invoices.delete'),
    ('owner', 'invoices.status'),
    -- Admin has create, update, and status permissions
    ('admin', 'invoices.create'),
    ('admin', 'invoices.update'),
    ('admin', 'invoices.status');
