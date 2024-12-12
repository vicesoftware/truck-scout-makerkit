# TruckScout Makerkit

Trucking Brokerage Management System

- [TruckScout Makerkit](#truckscout-makerkit)
  - [Setup](#setup)
  - [Stripe](#stripe)
    - [Supabase](#supabase)
  - [Project Structure](#project-structure)
    - [Core Application Structure](#core-application-structure)
    - [Documentation Organization](#documentation-organization)
      - [Key Documentation Files](#key-documentation-files)
    - [Key Configuration Files](#key-configuration-files)
    - [Testing Resources](#testing-resources)
    - [Development Tools](#development-tools)
    - [Feature Packages](#feature-packages)

## Setup

For working locally, please add a file named `.env.local` where we can place our environment variables. This file is not committed to Git, therefore it is safe to store sensitive information in it.

After starting Supabase, copy the service role key from the Supabase project settings and add it to the `.env.local` file.

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Stripe

For the Stripe integration, first we need to start the Stripe CLI:

```
pnpm run stripe:listen
```

Then, update the `.env.local` file with the following variables:

```
STRIPE_WEBHOOK_SECRET=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### Supabase

Please follow the instructions in the [Supabase README](../supabase/README.md) to setup your Supabase project.

## Project Structure

This section provides a comprehensive overview of the project's organization and where to find specific types of information.

### Core Application Structure

```
apps/
├── web/                    # Main web application
│   ├── app/               # Next.js application routes
│   ├── components/        # Reusable React components
│   ├── config/           # Application configuration
│   ├── lib/              # Utility functions and types
│   └── supabase/         # Database migrations and configuration
└── e2e/                   # End-to-end tests
    └── tests/            # Test suites for different features

packages/
├── analytics/            # Analytics integration
├── billing/             # Billing system implementation
├── features/            # Core feature implementations
├── ui/                  # Shared UI components
└── supabase/            # Supabase utilities
```

### Documentation Organization

```
docs/
├── planning/            # Project planning documents
│   ├── database-rls-plan.md
│   ├── invoice-rls-validation-queries.md
│   └── schema-alignment-plan.md
│
├── requirements/        # Project requirements
│   ├── database/       # Database-specific requirements
│   │   └── database.md # Core database documentation and best practices
│   └── project_plan.md
│
├── doc-driven-development.md    # Development methodology
├── schema-merge-analysis.md     # Database schema documentation
└── testing-best-practices.md    # Testing guidelines
```

#### Key Documentation Files

- `docs/requirements/database/database.md` - Essential database documentation containing:
  * Complete database schema definitions
  * Schema verification guidelines
  * Migration management best practices
  * Development workflows and commands
  * Troubleshooting guides
  * Critical rules for Supabase migrations
  * Common error solutions

### Key Configuration Files

- `apps/web/.env.*` - Environment configuration files
- `apps/web/next.config.mjs` - Next.js configuration
- `apps/web/tailwind.config.ts` - Tailwind CSS configuration
- `apps/web/supabase/config.toml` - Supabase configuration

### Testing Resources

- `apps/e2e/tests/` - End-to-end test suites
  - `authentication/` - Authentication tests
  - `rls/` - Row Level Security tests
  - `team-accounts/` - Team functionality tests
  - `user-billing/` - Billing system tests

### Development Tools

- `tooling/`
  - `eslint/` - ESLint configurations
  - `prettier/` - Code formatting rules
  - `tailwind/` - Tailwind CSS configurations
  - `typescript/` - TypeScript configurations

### Feature Packages

- `packages/features/`
  - `accounts/` - Account management
  - `admin/` - Admin panel functionality
  - `auth/` - Authentication features
  - `notifications/` - Notification system
  - `team-accounts/` - Team management

Each directory contains specific documentation and implementation details for its respective feature set. For more detailed information about specific components or features, refer to the README files within each directory.
