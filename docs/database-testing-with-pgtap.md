# Database Testing Guide

## Overview

Our database testing strategy utilizes pgTAP, a TAP-compliant testing framework for PostgreSQL. This approach allows us to write and run comprehensive tests that verify database schema, permissions, and business logic directly within the database.

## Testing Framework

### pgTAP

pgTAP is a unit testing framework for PostgreSQL that follows the Test Anything Protocol (TAP). It provides a comprehensive set of testing functions specifically designed for database testing, including:

- Schema validation
- Table and column existence
- Permission checks
- Trigger functionality
- Custom function testing

### Supabase Integration

Our tests are integrated with Supabase's development environment and use the `supabase-dbdev` package manager for managing database extensions and test helpers. Tests are located in `apps/web/supabase/tests/database/`.

### Required Extensions
```sql
create extension if not exists http with schema extensions;
create extension if not exists pg_tle;
create extension "basejump-supabase_test_helpers";
```

## Running Tests

### Prerequisites

Before running tests, ensure you have:
1. Supabase CLI installed
2. Local Supabase instance configured
3. Access to the project's database

### Test Execution

1. Reset the database to ensure a clean state:
```bash
pnpm run supabase:web:reset
```

2. Run the test suite:
```bash
pnpm --filter web supabase:test
```

This command executes all pgTAP tests in the database/tests directory and provides detailed output about test results.

## Test Structure

### File Organization

Tests are organized by feature and functionality:
- `00000-dbdev.sql`: Basic setup and extension tests
- `00000-makerkit-helpers.sql`: Helper function tests
- Feature-specific test files (e.g., `account-permissions.test.sql`, `invitations.test.sql`)

### Test File Anatomy

Each test file typically follows this structure:

```sql
-- Begin transaction
begin;

-- Load pgTAP and required extensions
create extension "basejump-supabase_test_helpers" version '0.0.6';

-- Declare test plan
select no_plan(); -- or select plan(n) for specific number of tests

-- Test cases
select has_table('public', 'table_name', 'Table should exist');
select has_column('public', 'table_name', 'column_name', 'Column should exist');
select col_is_pk('public', 'table_name', 'id', 'Should have primary key');

-- More specific tests
select results_eq(
    'SELECT count(*) FROM table_name',
    ARRAY[0::bigint],
    'Table should start empty'
);

-- Finish the test
select * from finish();

-- Rollback transaction
rollback;
```

## Test Categories

### 1. Schema Validation

#### Basic Schema Tests
```sql
-- Table existence checks
select has_table('public', 'accounts', 'Accounts table should exist');

-- RLS checks
select tests.rls_enabled('public', 'accounts');

-- Schema privileges
SELECT schema_privs_are(
    'public', 
    'anon', 
    Array[NULL], 
    'Anon should not have access to public schema'
);
```

#### Advanced Schema Validation
```sql
-- Comprehensive schema validation function
CREATE OR REPLACE FUNCTION check_schema_conditions()
RETURNS void AS
$$
DECLARE
  _table RECORD;
  _column RECORD;
  columnCheckCount INTEGER;
BEGIN
  -- Iterate through all tables in public schema
  FOR _table IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
  LOOP
    -- Check RLS enablement
    IF (
      SELECT relrowsecurity FROM pg_class
      INNER JOIN pg_namespace n ON n.oid = pg_class.relnamespace
      WHERE n.nspname = 'public' AND relname = _table.tablename
    ) IS FALSE THEN
      RAISE EXCEPTION 'Table "%" does not have RLS enabled.', _table.tablename;
    END IF;

    -- Check text column constraints
    FOR _column IN (
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = _table.tablename 
        AND data_type = 'text'
    )
    LOOP
      -- Verify constraints exist
      SELECT COUNT(*)
      INTO columnCheckCount
      FROM information_schema.constraint_column_usage
      WHERE table_schema = 'public' 
        AND table_name = _table.tablename 
        AND column_name = _column.column_name;

      IF columnCheckCount = 0 THEN
        RAISE NOTICE 'Text column "%.%" does not have a constraint.',
          _table.tablename, _column.column_name;
      END IF;
    END LOOP;
  END LOOP;
END
$$ LANGUAGE plpgsql;

-- Test the schema validation
select lives_ok(
  $$select check_schema_conditions();$$,
  'Schema should meet all conditions'
);
```

#### Storage Testing Patterns
```sql
-- Test bucket creation and policies
set local role postgres;
select lives_ok(
    $$ insert into storage.buckets ("name", "id", public) 
       values ('new_bucket', 'new_bucket', true); $$
);

-- Test custom bucket policies
create policy new_bucket_policy on storage.objects for all using (
  bucket_id = 'new_bucket'
  and auth.uid() = tests.get_supabase_uid('primary_owner')
)
with check (
  bucket_id = 'new_bucket'
  and auth.uid() = tests.get_supabase_uid('primary_owner')
);

-- Test storage permissions
select tests.authenticate_as('member');
select throws_ok(
    $$ insert into storage.objects (
         "bucket_id", "metadata", "name", "owner", "owner_id", "version"
       ) values (
         'new_bucket',
         '{"key": "value"}',
         'some name',
         tests.get_supabase_uid('primary_owner'),
         tests.get_supabase_uid('primary_owner'),
         1
       ); $$,
    'new row violates row-level security policy for table "objects"'
);

-- Test authorized access
select tests.authenticate_as('primary_owner');
select lives_ok(
    $$ insert into storage.objects (
         "bucket_id", "metadata", "name", "owner", "owner_id", "version"
       ) values (
         'new_bucket',
         '{"key": "value"}',
         'some name',
         tests.get_supabase_uid('primary_owner'),
         tests.get_supabase_uid('primary_owner'),
         1
       ); $$
);

-- Verify storage operations
select isnt_empty(
    $$ select * from storage.objects 
       where bucket_id = 'new_bucket' $$,
    'Object should be inserted into the bucket'
);
```
[Previous sections remain unchanged up to "Test Categories" -> "2. Permission Tests"]

### 2. Permission Tests

#### Role-Based Access Control (RBAC)

##### Setting Up Test Users and Roles
```sql
-- Create test users with different roles
select tests.create_supabase_user('user1', 'user1@test.com');
select tests.create_supabase_user('user2');

-- Authenticate as specific user
select tests.authenticate_as('user1');

-- Create test resource
select public.create_resource('Test Resource');
```

##### Testing Resource Owner Permissions
```sql
-- Test resource management permission
select row_eq(
  $$ select public.has_permission(
    auth.uid(), 
    get_resource_id('test-resource'), 
    'resource.manage'::permission_type
  ) $$,
  row(true::boolean),
  'Owner should have resource management permission'
);

-- Test data management permission
select row_eq(
  $$ select public.has_permission(
    auth.uid(), 
    get_resource_id('test-resource'), 
    'data.manage'::permission_type
  ) $$,
  row(true::boolean),
  'Owner should have data management permission'
);
```

##### Testing Access Restrictions
```sql
-- Test unauthorized access
select tests.authenticate_as('user2');
select row_eq(
  $$ select public.has_permission(
    auth.uid(), 
    get_resource_id('test-resource'), 
    'resource.manage'::permission_type
  ) $$,
  row(false::boolean),
  'Non-owners should not have permissions'
);
```

##### Custom Role Management
```sql
-- Test role name uniqueness
set local role postgres;
select throws_ok(
  $$ insert into public.roles (name, hierarchy_level) 
     values ('admin', 4) $$,
  'duplicate key value violates unique constraint "roles_pkey"'
);

-- Test hierarchy level uniqueness
select throws_ok(
  $$ insert into public.roles (name, hierarchy_level) 
     values ('custom-role', 1) $$,
  'duplicate key value violates unique constraint "roles_hierarchy_level_key"'
);

-- Assign custom role and permissions
update public.resource_roles
set role = 'custom-role'
where resource_id = get_resource_id('test-resource')
  and user_id = tests.get_supabase_uid('user1');

insert into public.role_permissions (role, permission) 
values ('custom-role', 'resource.manage');

-- Test custom role permissions
select tests.authenticate_as('user1');
select row_eq(
  $$ select public.has_permission(
    auth.uid(), 
    get_resource_id('test-resource'), 
    'data.manage'::permission_type
  ) $$,
  row(false::boolean),
  'Custom role should not have data management permission'
);
```

### 3. Business Logic

#### State Transition Workflow Testing

##### State Management
```sql
-- Test state transition
select lives_ok(
    $$ insert into public.workflow_items (
         name, status, created_by
       ) values (
         'Test Item',
         'draft',
         auth.uid()
       ); $$,
    'Can create item in initial state'
);

-- Test state transition rules
select throws_ok(
    $$ update public.workflow_items 
       set status = 'completed' 
       where status = 'draft' $$,
    'Invalid state transition from draft to completed'
);

select lives_ok(
    $$ update public.workflow_items 
       set status = 'in_review' 
       where status = 'draft' $$,
    'Valid state transition from draft to review'
);
```

##### Permission-Based State Changes
```sql
-- Test permission requirements
select throws_ok(
    $$ update public.workflow_items 
       set status = 'approved' 
       where status = 'in_review' $$,
    'Insufficient permissions for approval'
);

-- Grant approval permission
set local role postgres;
insert into public.role_permissions (role, permission) 
values ('reviewer', 'workflow.approve');

-- Test with proper permissions
select tests.authenticate_as('reviewer');
select lives_ok(
    $$ update public.workflow_items 
       set status = 'approved' 
       where status = 'in_review' $$,
    'Reviewer can approve items'
);
```

##### Function-Level Access Control
```sql
-- Test function with valid permissions
select lives_ok(
    $$ SELECT public.add_invitations_to_account(
         'makerkit',
         ARRAY[ROW('example@makerkit.dev', 'custom-role')::public.invitation]
       ); $$,
    'can create invitations via function'
);

-- Test function with invalid permissions
select throws_ok(
    $$ SELECT public.add_invitations_to_account(
         'makerkit',
         ARRAY[ROW('example2@makerkit.dev', 'owner')::public.invitation]
       ); $$,
    'new row violates row-level security policy for table "invitations"',
    'cannot invite with higher roles'`
);
```

##### Data Access Verification
```sql
-- Test data visibility
select isnt_empty(
    $$ select * from public.invitations 
       where account_id = makerkit.get_account_id_by_slug('makerkit') $$,
    'invitations should be listed for team members'
);

-- Test data isolation
select tests.create_supabase_user('user');
select tests.authenticate_as('user');
select is_empty(
    $$ select * from public.invitations 
       where account_id = makerkit.get_account_id_by_slug('makerkit') $$,
    'no invitations should be listed for non-members'
);
```

#### Team Account Management Testing

##### Account Creation and Ownership
```sql
-- Set up test users
select tests.create_supabase_user('test1', 'test1@test.com');
select tests.create_supabase_user('test2');

-- Test account creation
select tests.authenticate_as('test1');
select public.create_team_account('Test');

-- Verify account details
select row_eq(
    $$ select primary_owner_user_id, is_personal_account, slug, name
       from makerkit.get_account_by_slug('test') $$,
    row(tests.get_supabase_uid('test1'), false, 'test'::text, 'Test'::varchar),
    'Users can create a team account'
);

-- Verify owner role assignment
select row_eq(
    $$ select account_role 
       from public.accounts_memberships
       where account_id = (select id from public.accounts where slug = 'test')
         and user_id = tests.get_supabase_uid('test1') $$,
    row('owner'::varchar),
    'Primary owner should have owner role'
);
```

##### Access Control Testing
```sql
-- Test owner access
select isnt_empty(
    $$ select * from public.accounts
       where primary_owner_user_id = tests.get_supabase_uid('test1') $$,
    'Owner should see their team account'
);

-- Test non-member access
select tests.authenticate_as('test2');
select is_empty(
    $$ select * from public.accounts
       where primary_owner_user_id = tests.get_supabase_uid('test1') $$,
    'Non-members should not see team account'
);

-- Test role verification
select is(
    public.has_role_on_account((
        select id from makerkit.get_account_by_slug('test')
    )),
    false,
    'Non-members should not have any role'
);
```

##### Business Rule Enforcement
```sql
-- Test account limit trigger
set local role postgres;
create or replace function kit.single_account_per_owner()
    returns trigger as $$
declare
    total_accounts int;
begin
    select count(id)
    from public.accounts
    where primary_owner_user_id = auth.uid() 
    into total_accounts;

    if total_accounts > 0 then
        raise exception 'User can only own 1 account';
    end if;
    return NEW;
end
$$ language plpgsql set search_path = '';

-- Create trigger
create trigger single_account_per_owner
    before insert on public.accounts
    for each row
    execute function kit.single_account_per_owner();

-- Test account limit
select tests.authenticate_as('test1');
select throws_ok(
    $$ select public.create_team_account('Test2') $$,
    'User can only own 1 account'
);
```

##### Account Deletion Testing
```sql
-- Test unauthorized deletion
select tests.authenticate_as('test2');
select lives_ok(
    $$ delete from public.accounts 
       where id = (select id from makerkit.get_account_by_slug('test')) $$,
    'Non-owners attempt to delete should fail silently'
);

-- Verify account persistence
select tests.authenticate_as('test1');
select isnt_empty(
    $$ select * from public.accounts 
       where id = (select id from makerkit.get_account_by_slug('test')) $$,
    'Account should still exist after unauthorized deletion attempt'
);

-- Test authorized deletion
select lives_ok(
    $$ delete from public.accounts 
       where id = (select id from makerkit.get_account_by_slug('test')) $$,
    'Owner should be able to delete team account'
);

-- Verify deletion
select is_empty(
    $$ select * from public.accounts 
       where id = (select id from makerkit.get_account_by_slug('test')) $$,
    'Account should be deleted after owner deletion'
);
```

#### Slug Management Testing

##### Automatic Slug Generation
```sql
-- Set up test user
select tests.create_supabase_user('test1', 'test1@test.com');
select tests.authenticate_as('test1');

-- Test sequential slug generation
select public.create_team_account('Test');
select public.create_team_account('Test');
select public.create_team_account('Test');

-- Verify automatic slug creation
select row_eq(
  $$ select slug from public.accounts where name = 'Test' and slug = 'test' $$,
  row('test'::text),
  'First account should get base slug'
);

select row_eq(
  $$ select slug from public.accounts where name = 'Test' and slug = 'test-1' $$,
  row('test-1'::text),
  'Second account should get incremented slug'
);

select row_eq(
  $$ select slug from public.accounts where name = 'Test' and slug = 'test-2' $$,
  row('test-2'::text),
  'Third account should get incremented slug'
);
```

##### Slug Update Testing
```sql
-- Test automatic slug updates
update public.accounts set name = 'Test 4' where slug = 'test-2';

select row_eq(
  $$ select slug from public.accounts where name = 'Test 4' $$,
  row('test-4'::text),
  'Slug should update when name changes'
);

-- Test slug uniqueness constraint
select throws_ok(
  $$ update public.accounts set slug = 'test-1' where slug = 'test-4' $$,
  'duplicate key value violates unique constraint "accounts_slug_key"'
);
```

#### Resource Management Testing

##### Resource Creation and Ownership
```sql
-- Set up test users
select tests.create_supabase_user('test1', 'test1@test.com');
select tests.create_supabase_user('test2');

-- Test resource creation
select tests.authenticate_as('test1');
select lives_ok(
    $$ insert into public.resources (name, owner_id) 
       values ('Test Resource', auth.uid()) $$,
    'Users can create resources'
);

-- Verify ownership
select row_eq(
    $$ select owner_id from public.resources where name = 'Test Resource' $$,
    row(tests.get_supabase_uid('test1')),
    'Resource should be owned by creator'
);
```

##### Access Control Testing
```sql
-- Test owner access
select isnt_empty(
    $$ select * from public.resources 
       where owner_id = tests.get_supabase_uid('test1') $$,
    'Owner should see their resources'
);

-- Test non-owner access
select tests.authenticate_as('test2');
select is_empty(
    $$ select * from public.resources 
       where owner_id = tests.get_supabase_uid('test1') $$,
    'Non-owners should not see resources'
);
```

##### Resource Lifecycle Testing
```sql
-- Test resource updates
select tests.authenticate_as('test1');
select lives_ok(
    $$ update public.resources 
       set name = 'Updated Resource' 
       where owner_id = auth.uid() $$,
    'Owner can update their resources'
);

-- Test unauthorized updates
select tests.authenticate_as('test2');
select throws_ok(
    $$ update public.resources 
       set name = 'Hacked Resource' 
       where owner_id = tests.get_supabase_uid('test1') $$,
    'Non-owners cannot update resources'
);
```

#### Identifier Management Testing

##### Identifier Generation
```sql
-- Test basic identifier creation
select lives_ok(
    $$ insert into public.resources (name, identifier) 
       values ('Test', generate_identifier('Test')) $$,
    'Should generate valid identifier'
);

-- Test sequential identifiers
select lives_ok(
    $$ insert into public.resources (name, identifier) 
       values ('Test', generate_identifier('Test')) $$,
    'Should handle duplicate base identifiers'
);

-- Verify identifier patterns
select matches(
    identifier, 
    '^[a-z0-9-]+$',
    'Identifiers should follow format rules'
)
from public.resources
where name = 'Test';
```

##### Identifier Updates
```sql
-- Test identifier uniqueness
select throws_ok(
    $$ update public.resources 
       set identifier = 'existing-identifier' 
       where identifier = 'test-1' $$,
    'duplicate key value violates unique constraint'
);

-- Test format validation
select throws_ok(
    $$ update public.resources 
       set identifier = 'INVALID@ID' 
       where identifier = 'test-1' $$,
    'invalid identifier format'
);
```

#### Entity Management Testing

##### Entity Creation and Relationships
```sql
-- Test entity creation
select lives_ok(
    $$ insert into public.entities (name, owner_id) 
       values ('Test Entity', auth.uid()) $$,
    'Users can create entities'
);

-- Test relationship creation
select lives_ok(
    $$ insert into public.entity_relationships (
         parent_id, child_id, relationship_type
       ) values (
         parent_entity_id,
         child_entity_id,
         'hierarchical'
       ) $$,
    'Can establish entity relationships'
);
```

##### Hierarchical Relationship Testing
```sql
-- Test parent-child relationship
select row_eq(
    $$ select parent_id from public.entity_relationships 
       where child_id = child_entity_id $$,
    row(parent_entity_id),
    'Child should be linked to correct parent'
);

-- Test relationship constraints
select throws_ok(
    $$ insert into public.entity_relationships (parent_id, child_id)
       values (entity_id, entity_id) $$,
    'Self-referential relationships not allowed'
);
```

#### State Management Testing

##### State Transition Testing
```sql
-- Test valid state transition
select lives_ok(
    $$ update public.entities 
       set status = 'active' 
       where id = entity_id 
         and status = 'pending' $$,
    'Valid state transition should succeed'
);

-- Test invalid state transition
select throws_ok(
    $$ update public.entities 
       set status = 'completed' 
       where id = entity_id 
         and status = 'pending' $$,
    'Invalid state transition should fail'
);

-- Test state-based permissions
select throws_ok(
    $$ update public.entities 
       set data = jsonb_set(data, '{field}', '"value"') 
       where id = entity_id 
         and status = 'locked' $$,
    'Updates not allowed in locked state'
);
```

#### Unique Identifier Management

##### Identifier Generation Patterns
```sql
-- Test basic identifier generation
select matches(
    (select generate_identifier('base-string')),
    '^[a-z0-9-]+$',
    'Should generate valid identifier format'
);

-- Test collision handling
select distinct_from(
    (select generate_identifier('base-string')),
    (select generate_identifier('base-string')),
    'Should handle identifier collisions'
);

-- Test custom identifier patterns
select matches(
    (select generate_custom_identifier('[A-Z]{2}-\d{4}')),
    '^[A-Z]{2}-\d{4}$',
    'Should generate identifiers matching pattern'
);
```

##### Identifier Validation
```sql
-- Test format constraints
select throws_ok(
    $$ insert into public.entities (identifier) 
       values ('INVALID@ID') $$,
    'identifier_format_check',
    'Should enforce identifier format'
);

-- Test uniqueness scope
select throws_ok(
    $$ insert into public.entities (identifier, scope_id) 
       values ('existing-id', current_scope_id) $$,
    'unique_identifier_within_scope',
    'Should enforce scoped uniqueness'
);
```

#### Access Control Patterns

##### Permission Testing
```sql
-- Test role-based access
select results_eq(
    $$ select can_access(entity_id, current_role) $$,
    ARRAY[true],
    'Role should have proper access'
);

-- Test hierarchical permissions
select results_eq(
    $$ select has_permission(child_id, permission_type)
       from entity_relationships
       where parent_id = parent_entity_id $$,
    ARRAY[true],
    'Permissions should inherit through hierarchy'
);
```

##### Data Isolation
```sql
-- Test visibility boundaries
select is_empty(
    $$ select * from public.entities 
       where scope_id != current_scope_id $$,
    'Should not see entities from other scopes'
);

-- Test data access boundaries
select throws_ok(
    $$ update public.entities 
       set data = data || '{"field": "value"}'
       where scope_id != current_scope_id $$,
    'permission_denied',
    'Should not modify entities in other scopes'
);
```

## Best Practices

1. **Test Setup**
   - Use transactions with `begin` and `rollback`
   - Install required extensions at start
   - Use helper functions for common scenarios
   - Organize setup files with prefix (e.g., `00000-`)

2. **Schema Organization**
   - Create dedicated schemas for test helpers
   - Properly manage schema permissions:
   ```sql
   grant USAGE on schema test_schema to anon, authenticated, service_role;
   alter default PRIVILEGES in schema test_schema revoke execute on FUNCTIONS from public;
   alter default PRIVILEGES in schema test_schema grant execute on FUNCTIONS to anon, authenticated, service_role;
   ```

3. **Helper Functions**
   - Use `security definer` when needed
   - Set proper search paths
   - Include function-level tests
   - Document helper purposes

4. **Role-Based Testing**
   - Test with different roles (anon, authenticated, service_role)
   - Verify proper permission settings
   - Test security policies and RLS
   - Validate function execution privileges

5. **Test Independence**: Tests should not depend on each other
6. **Completeness**: Cover both success and failure cases
7. **Documentation**: Include clear descriptions for each test
8. **Performance**: Group related tests together

9. **Permission Testing Strategy**
   - Test each permission type explicitly
   - Verify role hierarchy enforcement
   - Test permission inheritance
   - Validate access boundaries
   - Check role transitions
   - Test custom role scenarios

10. **Role Management Testing**
    - Verify role uniqueness constraints
    - Test hierarchy level restrictions
    - Validate role assignments
    - Check permission combinations
    - Test role modifications
    - Verify permission inheritance

11. **Access Control Testing**
    - Test with different user contexts
    - Verify unauthorized access handling
    - Test permission boundaries
    - Validate role-based access
    - Check cross-user permissions
    - Test service role operations

12. **Workflow Testing Patterns**
    - Test complete business processes
    - Verify state transitions
    - Test unique constraints
    - Validate business rules
    - Check error conditions
    - Test edge cases

13. **Complex Permission Testing**
    - Test role hierarchy rules
    - Verify permission combinations
    - Test permission-based features
    - Validate access levels
    - Test permission changes
    - Check cascading permissions

14. **Data Validation Testing**
    - Test unique constraints
    - Verify data integrity rules
    - Test data relationships
    - Validate business logic
    - Check error handling
    - Test boundary conditions

15. **Storage Testing Best Practices**
    - Test bucket creation and configuration
    - Verify bucket policy enforcement
    - Test object operations (insert, read)
    - Validate storage permissions
    - Test custom bucket policies
    - Check access isolation between users

16. **Storage Policy Testing**
    - Test policy creation and application
    - Verify policy conditions
    - Test policy inheritance
    - Validate policy combinations
    - Check policy overrides
    - Test policy updates

17. **Entity Management Patterns**
    - Test entity creation and validation
    - Verify relationship constraints
    - Test hierarchical structures
    - Validate entity lifecycle
    - Test entity associations
    - Verify cascading effects

18. **State Management Patterns**
    - Test state transitions
    - Verify state constraints
    - Test state-based access
    - Validate state workflows
    - Check state history
    - Test state triggers

19. **Identifier Management Patterns**
    - Test identifier generation
    - Verify uniqueness constraints
    - Test scoped uniqueness
    - Validate format rules
    - Handle collisions
    - Test identifier stability

20. **Relationship Testing Patterns**
    - Test relationship types
    - Verify relationship constraints
    - Test relationship transitions
    - Validate relationship rules
    - Check relationship integrity
    - Test relationship queries

# Common Test Functions

```sql
-- Schema tests
has_table()
has_column()
col_is_pk()
col_has_default()

-- Permission tests
results_eq()
throws_ok()
lives_ok()

-- Custom assertions
ok()
is()
isnt()
isnt_empty()
```

## Troubleshooting

### Common Issues

1. **Duplicate Key Violations**
   - Usually indicates test data not being properly cleaned up
   - Solution: Ensure proper transaction management

2. **Missing RLS Policies**
   - Check schema-conditions.test.sql failures
   - Ensure all tables have RLS enabled and appropriate policies

3. **"Dubious" Test Results**
   - Often due to missing test plans
   - Add explicit `select plan(n)` statements

### Debug Mode

For more detailed output, run tests with debug mode:
```bash
SUPABASE_DB_TEST_DEBUG=true pnpm --filter web supabase:test
```

## Contributing New Tests

When adding new database features:

1. Create a new test file in `apps/web/supabase/tests/database/`
2. Follow the existing test file structure
3. Include tests for:
   - Schema validation
   - Permissions
   - Business logic
   - Edge cases
4. Run the full test suite to ensure no regressions

## Resources

- [pgTAP Documentation](https://pgtap.org/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/database/testing)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)



