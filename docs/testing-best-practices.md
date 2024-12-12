# Testing Best Practices in MakerKit and Turborepo Projects

## Core Principles

### 1. Minimal and Focused Testing
- Write tests that are precise and targeted
- Avoid unnecessary complexity
- Focus on core functionality
- Each test should have a single, clear purpose

### 2. CI/CD Integration
- Prefer running comprehensive tests in GitHub Actions
- Do not slow down local commits with extensive testing
- Use environment variables to control test execution

### 3. Test Environment Configuration

#### Environment Variables
- Use `.env` files for different environments
- Never commit real secrets
- Use placeholder values for testing environments
- Enable tests selectively with environment flags
- Load environment variables from specific project configurations when needed

#### Example Environment Setup
```bash
# Enable E2E tests
ENABLE_E2E_JOB=true

# Use development/testing credentials
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
```

### 4. Playwright Test Configuration

#### Key Configuration Strategies
- Use `test.skip()` to conditionally run tests
- Set up parallel test execution
- Configure retry mechanisms
- Use environment-specific settings

#### Example Playwright Configuration
```typescript
export default defineConfig({
  // Only run E2E tests when explicitly enabled
  testIgnore: process.env.ENABLE_E2E_JOB !== 'true'
    ? ['**/*.spec.ts']
    : [],

  // Optimize for CI/CD environment
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1,
});
```

### 5. Authentication and Security Testing

#### Authentication Test Patterns
- Use service role for admin-level user verification
- Validate user existence
- Check user metadata and account roles
- Verify minimal system interaction

#### Comprehensive Authentication Test Example
```typescript
test('validate user context and account membership', async () => {
  // Initialize Supabase client with service role
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Retrieve user information by ID
  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(testUser.userId);

  // Validate user exists and has correct email
  expect(userError).toBeNull();
  expect(userData?.user).toBeTruthy();
  expect(userData!.user!.email).toBe(testUser.email);

  // Check account membership
  const { data: membershipData, error: membershipError } =
    await supabase
      .from('accounts_memberships')
      .select('account_role')
      .eq('user_id', testUser.userId)
      .single();

  // Validate account membership
  expect(membershipError).toBeNull();
  expect(membershipData!.account_role).toBeDefined();
  expect(['owner', 'member', 'custom-role'])
    .toContain(membershipData!.account_role);
});
```

### 6. Performance Considerations
- Minimize test execution time
- Use parallel test execution
- Set reasonable timeouts
- Avoid unnecessary setup and teardown

### 7. Dependency Management
- Use `pnpm` for package management
- Leverage Turborepo for workspace-wide commands
- Keep test dependencies minimal

### 8. GitHub Actions Workflow
- Set up workflows in `.github/workflows/`
- Use matrix testing for multiple environments
- Cache dependencies
- Run type checking and linting before tests

### 9. Pre-Commit Hooks
- Implement pre-commit hooks for:
  - Type checking
  - Linting
  - Basic validation

#### Example Pre-Commit Hook
```bash
#!/bin/sh
pnpm run typecheck
pnpm run lint
```

### 10. Row-Level Security (RLS) Testing Best Practices

#### Test Data Management
- Use predefined test users with known roles and permissions
- Create dedicated test UUIDs for non-existent entities
- Maintain consistent test data across test suites
```typescript
const testUsers = {
  owner: {
    email: 'test@example.com',
    userId: '31a03e74-1639-45b6-bfa7-77447f1a4762'
  },
  member: {
    email: 'member@example.com',
    userId: 'member-test-user-id'
  }
};
```

#### Schema Validation
- Verify table structure and column existence
- Test RLS policies are active
- Validate data types and constraints
```typescript
test('Validate table schema and RLS policies', async () => {
  const { data, error } = await supabase
    .from('table_name')
    .select('id, field1, field2')
    .limit(0);

  expect(error).toBeNull();
  expect(data).toBeTruthy();
});
```

#### Access Control Testing
- Test CRUD operations for each role
- Verify unauthorized access is prevented
- Test cross-account access restrictions
```typescript
test('Verify RLS prevents unauthorized access', async () => {
  const { data, error } = await supabase
    .from('table_name')
    .select('*')
    .eq('account_id', NON_EXISTENT_ACCOUNT_ID)
    .limit(1);

  expect(data).toEqual([]);
  expect(error).toBeNull();
});
```

#### Related Records Management
- Create necessary related records before testing
- Clean up all related records after tests
- Maintain referential integrity
```typescript
// Create related records
const relatedData = {
  id: crypto.randomUUID(),
  account_id: testUsers.owner.userId
};

const { error } = await supabase
  .from('related_table')
  .insert(relatedData);

// Test main functionality

// Cleanup related records
await supabase
  .from('related_table')
  .delete()
  .eq('id', relatedData.id);
```

#### Property Validation
- Test all required fields exist
- Validate field types and formats
- Check computed or derived fields
```typescript
if (data) {
  data.forEach(record => {
    expect(record).toHaveProperty('id');
    expect(record).toHaveProperty('account_id');
    expect(record).toHaveProperty('created_at');
  });
}
```

#### Database Trigger Testing
1. **User Context Resolution**
   - Test triggers with both authenticated and service role contexts
   - Verify proper fallback behavior for missing user context
   - Validate JWT token handling in SECURITY DEFINER functions
   ```typescript
   test('Trigger handles user context correctly', async () => {
     // Test with authenticated user
     const { error: authError } = await userClient
       .from('invoices')
       .update({ status: 'pending' })
       .eq('id', invoiceId);

     // Verify audit log has correct user
     const { data: auditLog } = await adminClient
       .from('invoice_audit_log')
       .select('user_id')
       .eq('invoice_id', invoiceId)
       .single();

     expect(auditLog.user_id).toBe(testUser.id);
   });
   ```

2. **Common Trigger Anti-Patterns**
   - Avoid using `current_setting()` without `TRUE` parameter
   - Don't rely on hardcoded fallback users
   - Never skip user context validation
   ```sql
   -- BAD: Unreliable user context resolution
   current_user_id := current_setting('app.current_user_id');

   -- GOOD: Proper user context resolution with fallbacks
   current_user_id := COALESCE(
       CASE WHEN auth.jwt()->>'sub' IS NOT NULL
            THEN (auth.jwt()->>'sub')::uuid
            ELSE NULL
       END,
       auth.uid(),
       CASE WHEN current_setting('app.current_user_id', TRUE) IS NOT NULL
            THEN current_setting('app.current_user_id', TRUE)::uuid
            ELSE NULL
       END
   );
   ```

3. **RLS Policy Interactions**
   - Test trigger behavior with RLS policies enabled
   - Verify BEFORE triggers respect RLS policies
   - Test SECURITY DEFINER functions carefully
   ```typescript
   test('Trigger respects RLS policies', async () => {
     // Should fail due to RLS
     const { error: memberError } = await memberClient
       .from('invoices')
       .update({ status: 'paid' })
       .eq('id', invoiceId);

     expect(memberError).toBeTruthy();

     // Should succeed with proper role
     const { error: ownerError } = await ownerClient
       .from('invoices')
       .update({ status: 'paid' })
       .eq('id', invoiceId);

     expect(ownerError).toBeNull();
   });
   ```

4. **Audit Logging Best Practices**
   - Always capture both old and new values
   - Include user context in audit records
   - Test audit log completeness
   ```typescript
   test('Audit log captures changes correctly', async () => {
     const oldStatus = 'draft';
     const newStatus = 'pending';

     await ownerClient
       .from('invoices')
       .update({ status: newStatus })
       .eq('id', invoiceId);

     const { data: auditLog } = await adminClient
       .from('invoice_audit_log')
       .select('*')
       .eq('invoice_id', invoiceId)
       .single();

     expect(auditLog.old_value).toBe(oldStatus);
     expect(auditLog.new_value).toBe(newStatus);
     expect(auditLog.user_id).toBeDefined();
   });
   ```

5. **Error Handling in Triggers**
   - Test missing user context scenarios
   - Verify proper error messages
   - Validate transaction rollback behavior
   ```typescript
   test('Trigger handles errors appropriately', async () => {
     // Should fail with clear error
     const { error } = await serviceClient
       .rpc('update_invoice_status', {
         p_invoice_id: invoiceId,
         p_new_status: 'invalid_status'
       });

     expect(error.message).toContain('Invalid status transition');

     // Verify no partial updates
     const { data: invoice } = await serviceClient
       .from('invoices')
       .select('status')
       .eq('id', invoiceId)
       .single();

     expect(invoice.status).toBe('draft');
   });
   ```

### 11. Continuous Improvement
- Regularly review and update tests
- Maintain test coverage
- Automate where possible
- Keep tests fast and reliable

## Tools and Technologies
- Playwright
- Supabase
- GitHub Actions
- pnpm
- Turborepo

## Anti-Patterns to Avoid
- Running full test suites on every commit
- Committing real secrets
- Overly complex test setups
- Ignoring test performance
- Inconsistent testing approaches
- Not cleaning up test data
- Hardcoding test values without documentation
- Skipping RLS policy validation

## Recommended Reading
- [Playwright Documentation](https://playwright.dev/)
- [MakerKit Testing Guide](https://makerkit.dev/)
- [Turborepo Documentation](https://turbo.build/)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
