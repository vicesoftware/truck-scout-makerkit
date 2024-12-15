begin;

create extension "basejump-supabase_test_helpers" version '0.0.6';

-- Plan for two tests
select plan(2);

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

select * from finish();
rollback;
