begin;

create extension "basejump-supabase_test_helpers" version '0.0.6';

-- Plan for three tests
select plan(3);

/*
 * -------------------------------------------------------
 * Test 1: Anon Access
 * Verify anon role cannot access carriers table
 * -------------------------------------------------------
 */

-- First revoke all privileges from anon role
revoke all privileges on table public.carriers from anon;

-- Then test the privilege
select row_eq(
    $$ select has_table_privilege('anon', 'carriers', 'SELECT') $$,
    ROW(false),
    'anon role should not have SELECT privilege on carriers table'
);

/*
 * -------------------------------------------------------
 * Test 3: Owner Permissions
 * Verify owner can create carriers
 * -------------------------------------------------------
 */

-- Create and set up owner user
select tests.create_supabase_user('owner_user', 'owner@test.com');
select makerkit.set_identifier('owner_user', 'owner@test.com');

-- Create test account as owner
select tests.authenticate_as('owner_user');
select public.create_team_account('Test Account');

-- Test owner can create carrier
select lives_ok(
    $$ insert into public.carriers (account_id, name)
    values (makerkit.get_account_id_by_slug('test-account'), 'Test Carrier') $$,
    'Owner should be able to create carriers'
);

/*
 * -------------------------------------------------------
 * Test 4: Member Permission Boundaries
 * Verify member without carriers.manage cannot create carriers
 * -------------------------------------------------------
 */

-- Create and set up member user
select tests.create_supabase_user('member_user', 'member@test.com');
select makerkit.set_identifier('member_user', 'member@test.com');

-- Add member to account without carriers.manage permission
-- We need to set role to postgres to bypass RLS when adding the member
set local role postgres;
insert into public.accounts_memberships (user_id, account_id, account_role)
values (
    tests.get_supabase_uid('member_user'),
    makerkit.get_account_id_by_slug('test-account'),
    'member'
);
set local role authenticated;

-- Test member cannot create carrier
select tests.authenticate_as('member_user');
select throws_ok(
    $$ insert into public.carriers (account_id, name)
    values (makerkit.get_account_id_by_slug('test-account'), 'Test Carrier') $$,
    '42501',
    'new row violates row-level security policy for table "carriers"',
    'Member without carriers.manage permission should not be able to create carriers'
);

select * from finish();
rollback;
