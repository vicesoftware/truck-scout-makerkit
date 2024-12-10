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

### 10. Continuous Improvement
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

## Recommended Reading
- [Playwright Documentation](https://playwright.dev/)
- [MakerKit Testing Guide](https://makerkit.dev/)
- [Turborepo Documentation](https://turbo.build/)
