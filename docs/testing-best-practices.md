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
# Run all tests
pnpm run test

# Run specific test file from e2e directory
cd apps/e2e && pnpm run test tests/path/to/file.spec.ts
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
