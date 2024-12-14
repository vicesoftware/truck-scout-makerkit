# Testing Best Practices

This document outlines the testing practices and workflows for the TruckScout project.

## Test Types

1. **E2E Tests**: Located in `apps/e2e/tests/`, these tests use Playwright to verify full application workflows
2. **Type Checking**: Ensures TypeScript type safety across the codebase
3. **Billing Tests**: Optional tests for payment-related features (disabled by default)
4. **Utility Tests**: Located in `apps/e2e/tests/utils/`, these tests verify core functionality like database access and helper functions

## Running Tests Locally

### Prerequisites

Before running tests, ensure you have:
1. Node.js and pnpm installed
2. All project dependencies installed (`pnpm install`)
3. Environment variables set up (copy `.env.test.example` to `.env.test` and fill in the values)

### Environment Variables

#### Setup and Configuration
- Each test environment (local, CI) requires specific environment variables
- Environment variables are loaded using dotenv-cli to ensure consistent behavior
- The `.env.test` file is used for local testing environment variables
- Never use raw `playwright test` commands without proper env file loading

#### Required Files
1. `.env.test.example` - Template file showing required variables
2. `.env.test` - Local testing environment variables (do not commit)
3. `.env` - Development environment variables (do not commit)

#### Best Practices for Env Variables
1. Always use `pnpm test` script which properly loads `.env.test`
2. Never directly run `playwright test` without dotenv-cli
3. Keep test-specific variables separate from development variables
4. Document all required variables in `.env.test.example`
5. Validate environment variables early in test setup
6. Use descriptive error messages for missing variables

### Basic Test Workflow

1. Start Supabase:
```bash
pnpm run supabase:web:start
```

2. Start the development server:
```bash
pnpm --filter web dev
```

3. Run the tests:
```bash
# Run all tests (CORRECT way - uses dotenv-cli to load .env.test)
pnpm test

# Run specific test file (CORRECT way)
cd apps/e2e && pnpm test tests/path/to/file.spec.ts

# INCORRECT - Don't use these commands as they skip env loading:
❌ pnpm playwright test
❌ npx playwright test
❌ playwright test
```

### Running Combined Commands

When running multiple commands together (e.g., resetting database and running tests):
```bash
# CORRECT way - uses pnpm test to properly load env variables
cd apps/web && pnpm supabase:reset && cd ../e2e && ENABLE_E2E_JOB=true pnpm test

# INCORRECT - doesn't properly load env variables
❌ cd apps/web && pnpm supabase:reset && cd ../e2e && ENABLE_E2E_JOB=true pnpm playwright test
```

### Optional: Billing Tests

To run billing tests:

1. Set environment variable:
```bash
export ENABLE_BILLING_TESTS=true
```

2. Start Stripe webhook listener:
```bash
pnpm run stripe:listen
```

## Continuous Integration

Tests are automatically run in GitHub Actions on every push. The workflow includes:
- TypeScript type checking
- Playwright E2E tests
- Optional billing tests (when enabled)

## Writing Tests

### E2E Tests
- Place tests in `apps/e2e/tests/`
- Use Playwright's testing utilities
- Follow the existing patterns in auth.spec.ts and other test files

### Environment Setup
- Never commit `.env*` files to git
- Always provide an `.env.test.example` file with placeholder values
- Required environment variables should be documented in the example file

### Best Practices
1. Keep tests focused and atomic
2. Use meaningful descriptions
3. Clean up test data after each run
4. Avoid test interdependencies
5. Place reusable test utilities in `apps/e2e/tests/utils/`
6. Always include proper error handling and cleanup in try/finally blocks
7. Test files should match the module they're testing (e.g., `supabase.ts` → `supabase.spec.ts`)
8. Always validate required environment variables at the start of tests
9. Use clear error messages that indicate missing or invalid environment variables
10. Keep environment variable validation in a centralized utility function


## E2E Testing with Supabase

### Account and User Setup

When setting up test data with Supabase, it's important to understand the relationship between accounts, users, and permissions:

1. **Account Structure**
   - Each account has a primary owner (set during account creation)
   - Additional users can be members of an account with different roles (owner, admin, member)
   - Permissions are based on a user's role within an account

2. **Test Setup Pattern**
   ```typescript
   // 1. Create the main account and owner
   const ownerSetup = await createTestAccountWithUser({
     email: `owner-test-${Date.now()}@example.com`,
     password: 'TestPassword123!',
     role: 'owner'
   });
   const ownerAccount = ownerSetup.account;

   // 2. Add additional users to the account
   const adminUser = await addUserToAccount(ownerAccount.id, {
     email: `admin-test-${Date.now()}@example.com`,
     password: 'TestPassword123!',
     role: 'admin'
   });

   // 3. Create an authenticated client for API calls
   const adminClient = await createAuthenticatedClient(adminUser);
   ```

3. **Permission Checking**
   - Always verify permissions before attempting operations
   - Users must be members of an account to have permissions
   ```typescript
   const hasPermission = await hasPermission(
     client,
     accountId,
     'permission.name'
   );
   ```

4. **Cleanup**
   - Use cleanupTestAccount to remove test data
   - This handles deletion order for foreign key constraints
   - The owner membership is automatically removed when the account is deleted

### Common Issues to Avoid

1. **Account Membership**
   - ❌ DON'T create separate accounts for admin/member users
   - ✅ DO add them to the main test account instead
   - This ensures proper permission inheritance

2. **Permission Testing**
   - ❌ DON'T assume users have permissions just because of their role
   - ✅ DO check permissions before operations
   - ✅ DO verify users are members of the target account

3. **Data Cleanup**
   - ❌ DON'T try to delete owner memberships directly
   - ✅ DO clean up in the correct order (foreign key constraints)
   - ✅ DO let account deletion handle cascade deletes

### Database Schema Overview

1. **Accounts Table**
   - Primary table for organizations/workspaces
   - Has a primary_owner_user_id field
   - Contains basic account info (name, slug, etc.)

2. **Accounts Memberships Table**
   - Links users to accounts
   - Stores the user's role in the account
   - One user can be a member of multiple accounts

3. **Roles and Permissions**
   - Roles have hierarchy levels (owner > admin > member)
   - Permissions are granted to roles
   - The has_permission function checks role-based access

### Utility Functions

The test utilities provide several helper functions:

1. `createTestAccountWithUser`
   - Creates an account and its primary owner
   - Use this first when setting up test data
   ```typescript
   const { account, user } = await createTestAccountWithUser({
     email: 'test@example.com',
     password: 'password',
     role: 'owner'
   });
   ```

2. `addUserToAccount`
   - Adds additional users to an existing account
   - Use this for admin/member test users
   ```typescript
   const adminUser = await addUserToAccount(accountId, {
     email: 'admin@example.com',
     password: 'password',
     role: 'admin'
   });
   ```

3. `createAuthenticatedClient`
   - Creates a Supabase client for API calls
   - Handles authentication automatically
   ```typescript
   const client = await createAuthenticatedClient(user);
   ```

4. `hasPermission`
   - Checks if a user has a specific permission
   - Requires account membership
   ```typescript
   const canManage = await hasPermission(
     client,
     accountId,
     'resource.manage'
   );
   ```

5. `cleanupTestAccount`
   - Removes all test data for an account
   - Handles deletion order automatically
   ```typescript
   await cleanupTestAccount(accountId);
   ```

### Example Test Structure

```typescript
test.describe('Feature Tests', () => {
  let ownerAccount: TestAccount;
  let adminUser: TestUser;

  test.beforeAll(async () => {
    // 1. Create owner account
    const ownerSetup = await createTestAccountWithUser({
      email: `owner-test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      role: 'owner'
    });
    ownerAccount = ownerSetup.account;

    // 2. Add admin user to owner's account
    adminUser = await addUserToAccount(ownerAccount.id, {
      email: `admin-test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      role: 'admin'
    });
  });

  test.afterAll(async () => {
    await cleanupTestAccount(ownerAccount.id);
  });

  test('Admin can perform action', async () => {
    const adminClient = await createAuthenticatedClient(adminUser);
    
    // Verify permissions
    const hasAccess = await hasPermission(
      adminClient,
      ownerAccount.id,
      'feature.permission'
    );
    expect(hasAccess).toBe(true);

    // Perform test
    // ...
  });
});
```

### Troubleshooting Common Errors

1. **Permission Denied**
   ```
   Error: Permission denied for resource
   ```
   - Check if the user is a member of the correct account
   - Verify the user has the correct role
   - Use hasPermission to debug permission issues

2. **Foreign Key Violation**
   ```
   Error: violates foreign key constraint
   ```
   - Clean up data in the correct order
   - Use cleanupTestAccount instead of manual deletion

3. **Cannot Delete Owner**
   ```
   Error: The primary account owner cannot be removed
   ```
   - Don't try to delete owner memberships directly
   - Delete the account instead (it will cascade)

4. **User Not Found**
   ```
   Error: User not found or invalid credentials
   ```
   - Verify the user was created successfully
   - Check if the user is authenticated
   - Ensure you're using the correct email/password
