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

-- Load pgTAP
select plan(n); -- where n is the number of tests

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
- Table existence
- Column definitions
- Constraints
- Indexes

### 2. Permission Tests
- Row Level Security (RLS) policies
- Role-based access
- User permissions

### 3. Business Logic
- Account management
- Billing operations
- Team permissions
- Invitation system

### 4. Data Integrity
- Trigger functionality
- Cascading operations
- Unique constraints

## Best Practices

1. **Isolation**: Each test file should run in a transaction that gets rolled back
2. **Independence**: Tests should not depend on each other
3. **Completeness**: Cover both success and failure cases
4. **Documentation**: Include clear descriptions for each test
5. **Performance**: Group related tests together to minimize setup/teardown overhead

## Common Test Functions

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
