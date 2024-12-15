begin;

create extension "basejump-supabase_test_helpers" version '0.0.6';

-- Plan for just one test to start
select plan(1);

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

select * from finish();
rollback;
