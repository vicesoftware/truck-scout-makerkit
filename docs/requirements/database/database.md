# Database Schema for TruckingApp <!-- omit in toc -->

This document contains the DBML representation of the database schema for the TruckingApp. Two versions of the schema are provided:
1. A **version with schemas** to organize tables into logical groupings.
2. A **version without schemas** for tools that do not support schema definitions.

- [Database Management Workflow](#database-management-workflow)
  - [Supabase and Database Operations](#supabase-and-database-operations)
    - [Local Development Setup](#local-development-setup)
    - [Starting Local Supabase](#starting-local-supabase)
    - [Database Migrations](#database-migrations)
      - [Applying Migrations](#applying-migrations)
      - [Creating a New Migration](#creating-a-new-migration)
    - [Database Type Generation](#database-type-generation)
  - [Best Practices](#best-practices)
  - [Typical Development Workflow](#typical-development-workflow)
  - [Debugging and Troubleshooting](#debugging-and-troubleshooting)
    - [Reset Local Database](#reset-local-database)
    - [Check Supabase Status](#check-supabase-status)
    - [View Supabase Logs](#view-supabase-logs)
  - [Production Considerations](#production-considerations)
  - [Troubleshooting](#troubleshooting)
    - [Migration Conflicts](#migration-conflicts)
    - [Type Generation Issues](#type-generation-issues)
  - [Security Notes](#security-notes)
- [**Schemas Overview**](#schemas-overview)
- [**Entity Descriptions**](#entity-descriptions)
  - [Auth Schema (Supabase)](#auth-schema-supabase)
  - [Public Schema (Core)](#public-schema-core)
  - [Kit Schema (Utilities)](#kit-schema-utilities)
- [**About DBML and Visualization**](#about-dbml-and-visualization)
  - [**Full Version with Schema**](#full-version-with-schema)
  - [**DBML without Schemas**](#dbml-without-schemas)
    - [Database Migrations](#database-migrations-1)
      - [Applying Migrations](#applying-migrations-1)
      - [Creating a New Migration](#creating-a-new-migration-1)
    - [Database Type Generation](#database-type-generation-1)
  - [Best Practices](#best-practices-1)
  - [Typical Development Workflow](#typical-development-workflow-1)
  - [Debugging and Troubleshooting](#debugging-and-troubleshooting-1)
    - [Reset Local Database](#reset-local-database-1)
    - [Check Supabase Status](#check-supabase-status-1)
    - [View Supabase Logs](#view-supabase-logs-1)
  - [Production Considerations](#production-considerations-1)
  - [Troubleshooting](#troubleshooting-1)
    - [Migration Conflicts](#migration-conflicts-1)
    - [Type Generation Issues](#type-generation-issues-1)
  - [Security Notes](#security-notes-1)


## Database Management Workflow

### Supabase and Database Operations

#### Local Development Setup
- Ensure `pnpm` is installed
- Docker must be running
- Supabase CLI is installed via project dependencies

#### Starting Local Supabase
```bash
# Start Supabase local development environment
pnpm run supabase:web:start
```

#### Database Migrations

##### Applying Migrations
```bash
# Apply all pending migrations
pnpm run --filter web supabase migrations up
```

##### Creating a New Migration
```bash
# Create a new migration file
pnpm run --filter web supabase migrations new description_of_change
```

#### Database Type Generation
```bash
# Generate Supabase types for client-side use
pnpm run supabase:web:typegen
```

### Best Practices

1. Always generate types after migration changes
2. Use migrations for schema evolution
3. Avoid direct database modifications
4. Test migrations in local environment before production
5. Trigger Implementation Guidelines:
   - Use BEFORE triggers for RLS compatibility
   - Implement robust user context handling:
     ```sql
     -- Example of proper user context resolution
     current_user_id := COALESCE(
         CASE WHEN auth.jwt()->>'sub' IS NOT NULL THEN (auth.jwt()->>'sub')::uuid ELSE NULL END,
         auth.uid(),
         CASE WHEN current_setting('app.current_user_id', TRUE) IS NOT NULL
              THEN current_setting('app.current_user_id', TRUE)::uuid
              ELSE NULL END
     );
     ```
   - Use SECURITY DEFINER sparingly and only for audit logging
   - Always set search_path in SECURITY DEFINER functions
   - Validate permissions before state changes
   - Handle NULL values gracefully in all cases
   - Implement proper error handling for missing context
   - Consider RLS policies when designing triggers:
     * BEFORE triggers can modify data before RLS policies
     * AFTER triggers might not have access to modified data
     * Use explicit error handling for permission checks

6. Function Security Best Practices:
   - Minimize use of SECURITY DEFINER
   - Always specify search_path in SECURITY DEFINER functions
   - Validate all input parameters thoroughly
   - Implement proper error handling
   - Use type casting with COALESCE for safer operations
   - Document security implications in function headers

7. Audit Logging Best Practices:
   - Always capture user context in audit logs
   - Include both old and new values for changes
   - Store reasons for sensitive operations
   - Use consistent change_type values
   - Implement proper error handling for audit failures

8. Status Management Best Practices:
   - Implement strict state transition validation
   - Use role-based permission checks for status changes
   - Log all status transitions with user context
   - Require reasons for sensitive status changes
   - Prevent modifications to finalized states

### Typical Development Workflow

```bash
# Database development process
1. Make schema changes
2. pnpm run --filter web supabase migrations new description_of_change
3. Edit the new migration file
4. pnpm run --filter web supabase migrations up
5. pnpm run supabase:web:typegen
```

### Debugging and Troubleshooting

#### Reset Local Database
```bash
# Reset Supabase database to initial state
pnpm run supabase:web:reset
```

#### Check Supabase Status
```bash
# Verify local Supabase services
pnpm run supabase:web:status
```

#### View Supabase Logs
```bash
# Display Supabase service logs
pnpm run --filter web supabase logs
```

### Production Considerations

- Migrations are version-controlled
- Use `supabase migrations push` for production deployments
- Always backup production database before migrations

### Troubleshooting

#### Migration Conflicts
- Resolve conflicts manually in migration files
- Ensure linear migration history
- Use meaningful, descriptive migration names

#### Type Generation Issues
- Regenerate types after each schema change
- Check for compilation errors
- Verify Supabase CLI and project configuration

### Security Notes

- Never commit sensitive credentials
- Use environment-specific configurations
- Limit database access permissions


## **Schemas Overview**

| Schema Name | Description                                                                                   |
|-------------|-----------------------------------------------------------------------------------------------|
| `auth`      | Manages user authentication and Supabase integration.                                         |
| `public`    | Core functionality for multi-tenancy and SaaS features like accounts, roles, and memberships. Domain-specific entities such as carriers, loads, vehicles, and drivers.                     |
| `kit`       | Utility tables for analytics, documents, and custom functionality.                           |

## **Entity Descriptions**

### Auth Schema (Supabase)
| Entity Name | Description                                                                                      |
|------------|--------------------------------------------------------------------------------------------------|
| `users`    | Stores user authentication data.                                                                  |

### Public Schema (Core)
| Entity Name            | Description                                                                           |
|-----------------------|---------------------------------------------------------------------------------------|
| `accounts`            | Represents customer accounts for the SaaS platform.                                    |
| `accounts_memberships`| Links users to accounts and defines their roles within those accounts.                 |
| `roles`               | Defines role types (e.g., owner, admin, member) and their hierarchy.                   |
| `role_permissions`    | Specifies permissions for each role.                                                   |
| `carriers`           | Represents trucking carriers and their details, including factoring company associations.|
| `drivers`            | Stores information about drivers, such as license numbers and contact info.             |
| `vehicles`           | Manages vehicles, including their VIN, license plate, and status.                       |
| `loads`              | Represents freight loads, including origin, destination, and assigned carriers.         |
| `invoices`           | Manages invoices associated with loads and carriers.                                    |
| `contacts`           | Stores contact information for key individuals in the trucking operations.              |
| `factoring_companies`| Details factoring companies used by carriers for invoice payments.                      |

### Kit Schema (Utilities)
| Entity Name  | Description                                                                                     |
|--------------|-------------------------------------------------------------------------------------------------|
| `analytics`  | Stores analytics data and reports for accounts.                                                 |
| `documents`  | Manages uploaded documents linked to specific entities like carriers, drivers, or loads.         |

---

## **About DBML and Visualization**

[DBML (Database Markup Language)](https://www.dbml.org/) is a DSL for documenting database schemas. While our schema uses multiple database schemas (auth, public, kit), some visualization tools like dbdiagram.io don't support this feature. Therefore, we maintain two versions:

1. **Full Version with Schemas** (in this document)
   - Complete schema organization
   - Used for comprehensive documentation and reference
   - Not compatible with all visualization tools

2. **Simplified Version without Schemas** 
   - Current visualization: [View Diagram](https://dbdiagram.io/d/6755e856e9daa85aca0b7370)
   - Removes schema prefixes for compatibility with visualization tools
   - Used for visual representation

When updating the schema, use the [TruckScout Product Owner GPT](https://chatgpt.com/g/g-67545b7de2088191b29e78715371ac98-truck-scout-product-owner) to maintain both versions and ensure changes align with business requirements.

### **Full Version with Schema**

```dbml
// Project Information
Project TruckingApp {
  note: "Database schema for trucking and SaaS"
}

// Schemas Definition
Schema auth {
  description: "Supabase-managed authentication"
}

Schema public {
  description: "Core SaaS functionality and multi-tenancy"
}

Schema kit {
  description: "Utilities and custom functions"
}

// Tables in 'auth'
Table auth.users {
  id UUID [pk]
  email VARCHAR(255)
  encrypted_password VARCHAR(255)
  email_confirmed_at TIMESTAMP
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

// Tables in 'public'
Table public.accounts {
  id UUID [pk]
  primary_owner_user_id UUID [ref: > auth.users.id]
  name VARCHAR(255)
  slug VARCHAR(255) [unique]
  email VARCHAR(320)
  is_personal_account BOOLEAN
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table public.accounts_memberships {
  user_id UUID [pk, ref: > auth.users.id]
  account_id UUID [pk, ref: > public.accounts.id]
  account_role VARCHAR(50)
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table public.roles {
  name VARCHAR(50) [pk]
  hierarchy_level INT
}

Table public.role_permissions {
  id BIGINT [pk]
  role VARCHAR(50) [ref: > public.roles.name]
  permission VARCHAR(50)
}

Table public.carriers {
  id UUID [pk]
  account_id UUID [ref: > public.accounts.id]
  name VARCHAR(255)
  mc_number VARCHAR(50)
  contact_info JSONB
  rating DECIMAL(3,2)
  preferred_status BOOLEAN
  factoring_company_id UUID [ref: > public.factoring_companies.id]
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table public.drivers {
  id UUID [pk]
  account_id UUID [ref: > public.accounts.id]
  name VARCHAR(255)
  license_number VARCHAR(50) [unique]
  phone VARCHAR(20)
  email VARCHAR(255)
  status VARCHAR(50) [note: 'Values: active, inactive, suspended']
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table public.vehicles {
  id UUID [pk]
  account_id UUID [ref: > public.accounts.id]
  vin VARCHAR(50) [unique]
  make VARCHAR(255)
  model VARCHAR(255)
  year INT
  license_plate VARCHAR(20) [unique]
  status VARCHAR(50) [note: 'Values: active, maintenance, decommissioned']
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table public.loads {
  id UUID [pk]
  account_id UUID [ref: > public.accounts.id]
  origin VARCHAR(255)
  destination VARCHAR(255)
  pickup_date TIMESTAMP
  delivery_date TIMESTAMP
  status VARCHAR(50)
  carrier_id UUID [ref: > public.carriers.id]
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table public.invoices {
  id UUID [pk]
  account_id UUID [ref: > public.accounts.id]
  load_id UUID [ref: > public.loads.id]
  carrier_id UUID [ref: > public.carriers.id]
  amount DECIMAL(10,2) [not null]
  status TEXT [not null, default: 'Draft', note: 'Values: Draft, Pending, Paid, Void']
  due_date TIMESTAMP WITH TIME ZONE
  paid_status BOOLEAN [default: false]
  bank_details TEXT
  payment_details TEXT
  status_change_reason TEXT
  internal_notes TEXT
  created_at TIMESTAMP WITH TIME ZONE [default: now()]
  updated_at TIMESTAMP WITH TIME ZONE [default: now()]
}

Table public.invoice_audit_log {
  id UUID [pk]
  invoice_id UUID [ref: > public.invoices.id]
  user_id UUID [not null]
  change_type TEXT [not null]
  old_value TEXT
  new_value TEXT
  change_reason TEXT
  created_at TIMESTAMP WITH TIME ZONE [default: now()]
}

View public.invoice_details {
  id UUID [ref: > public.invoices.id]
  account_id UUID
  load_id UUID
  carrier_id UUID
  amount DECIMAL(10,2)
  status TEXT
  due_date TIMESTAMP WITH TIME ZONE
  paid_status BOOLEAN
  masked_bank_details TEXT [note: 'Masked for non-privileged roles']
  masked_payment_details TEXT [note: 'Masked for non-privileged roles']
  internal_notes TEXT
  created_at TIMESTAMP WITH TIME ZONE
  updated_at TIMESTAMP WITH TIME ZONE
}

Table public.contacts {
  id UUID [pk]
  account_id UUID [ref: > public.accounts.id]
  name VARCHAR(255)
  email VARCHAR(255)
  phone VARCHAR(20)
  role VARCHAR(255)
  notes TEXT
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table public.factoring_companies {
  id UUID [pk]
  account_id UUID [ref: > public.accounts.id]
  name VARCHAR(255)
  contact_info JSONB
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

// Tables in 'kit'
Table kit.analytics {
  id UUID [pk]
  account_id UUID [ref: > public.accounts.id]
  report_name VARCHAR(255)
  report_data JSONB
  created_at TIMESTAMP
}

Table kit.documents {
  id UUID [pk]
  account_id UUID [ref: > public.accounts.id]
  associated_entity_id UUID
  entity_type VARCHAR(50) [note: 'Values: carrier, driver, vehicle, load']
  document_type VARCHAR(50)
  file_url VARCHAR(1000)
  uploaded_at TIMESTAMP
  expiry_date TIMESTAMP
  created_at TIMESTAMP
}
```

---

### **DBML without Schemas**

```dbml
// Project Information
Project TruckingApp {
  note: "Database schema for trucking and SaaS"
}

// Users Table
Table users {
  id UUID [pk]
  email VARCHAR(255)
  encrypted_password VARCHAR(255)
  email_confirmed_at TIMESTAMP
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

// Accounts and Roles
Table accounts {
  id UUID [pk]
  primary_owner_user_id UUID [ref: > users.id]
  name VARCHAR(255)
  slug VARCHAR(255) [unique]
  email VARCHAR(320)
  is_personal_account BOOLEAN
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table accounts_memberships {
  user_id UUID [pk, ref: > users.id]
  account_id UUID [pk, ref: > accounts.id]
  account_role VARCHAR(50)
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table roles {
  name VARCHAR(50) [pk]
  hierarchy_level INT
}

Table role_permissions {
  id BIGINT [pk]
  role VARCHAR(50) [ref: > roles.name]
  permission VARCHAR(50)
}

// Analytics and Documents
Table analytics {
  id UUID [pk]
  account_id UUID [ref: > accounts.id]
  report_name VARCHAR(255)
  report_data JSONB
  created_at TIMESTAMP
}

Table documents {
  id UUID [pk]
  account_id UUID [ref: > accounts.id]
  associated_entity_id UUID
  entity_type VARCHAR(50) [note: 'Values: carrier, driver, vehicle, load']
  document_type VARCHAR(50)
  file_url VARCHAR(1000)
  uploaded_at TIMESTAMP
  expiry_date TIMESTAMP
  created_at TIMESTAMP
}

// Trucking-Specific Tables
Table carriers {
  id UUID [pk]
  account_id UUID [ref: > accounts.id]
  name VARCHAR(255)
  mc_number VARCHAR(50)
  contact_info JSONB
  rating DECIMAL(3,2)
  preferred_status BOOLEAN
  factoring_company_id UUID [ref: > factoring_companies.id]
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table drivers {
  id UUID [pk]
  account_id UUID [ref: > accounts.id]
  name VARCHAR(255)
  license_number VARCHAR(50) [unique]
  phone VARCHAR(20)
  email VARCHAR(255)
  status VARCHAR(50) [note: 'Values: active, inactive, suspended']
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table vehicles {
  id UUID [pk]
  account_id UUID [ref: > accounts.id]
  vin VARCHAR(50) [unique]
  make VARCHAR(255)
  model VARCHAR(255)
  year INT
  license_plate VARCHAR(20) [unique]
  status VARCHAR(50) [note: 'Values: active, maintenance, decommissioned']
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table loads {
  id UUID [pk]
  account_id UUID [ref: > accounts.id]
  origin VARCHAR(255)
  destination VARCHAR(255)
  pickup_date TIMESTAMP
  delivery_date TIMESTAMP
  status VARCHAR(50)
  carrier_id UUID [ref: > carriers.id]
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table invoices {
  id UUID [pk]
  account_id UUID [ref: > accounts.id]
  load_id UUID [ref: > loads.id]
  carrier_id UUID [ref: > carriers.id]
  amount DECIMAL(10,2) [not null]
  status TEXT [not null, default: 'Draft', note: 'Values: Draft, Pending, Paid, Void']
  due_date TIMESTAMP WITH TIME ZONE
  paid_status BOOLEAN [default: false]
  bank_details TEXT
  payment_details TEXT
  status_change_reason TEXT
  internal_notes TEXT
  created_at TIMESTAMP WITH TIME ZONE [default: now()]
  updated_at TIMESTAMP WITH TIME ZONE [default: now()]
}

Table invoice_audit_log {
  id UUID [pk]
  invoice_id UUID [ref: > invoices.id]
  user_id UUID [not null]
  change_type TEXT [not null]
  old_value TEXT
  new_value TEXT
  change_reason TEXT
  created_at TIMESTAMP WITH TIME ZONE [default: now()]
}

View invoice_details {
  id UUID [ref: > invoices.id]
  account_id UUID
  load_id UUID
  carrier_id UUID
  amount DECIMAL(10,2)
  status TEXT
  due_date TIMESTAMP WITH TIME ZONE
  paid_status BOOLEAN
  masked_bank_details TEXT [note: 'Masked for non-privileged roles']
  masked_payment_details TEXT [note: 'Masked for non-privileged roles']
  internal_notes TEXT
  created_at TIMESTAMP WITH TIME ZONE
  updated_at TIMESTAMP WITH TIME ZONE
}

Table contacts {
  id UUID [pk]
  account_id UUID [ref: > accounts.id]
  name VARCHAR(255)
  email VARCHAR(255)
  phone VARCHAR(20)
  role VARCHAR(255)
  notes TEXT
  created_at TIMESTAMP
  updated_at TIMESTAMP
}

Table factoring_companies {
  id UUID [pk]
  account_id UUID [ref: > accounts.id]
  name VARCHAR(255)
  contact_info JSONB
  created_at TIMESTAMP
  updated_at TIMESTAMP
}


## Database Management Workflow

### Supabase and Database Operations

#### Local Development Setup
- Ensure `pnpm` is installed
- Docker must be running
- Supabase CLI is installed via project dependencies

#### Starting Local Supabase
```bash
# Start Supabase local development environment
pnpm run supabase:web:start
```

#### Database Migrations

##### Applying Migrations
```bash
# Apply all pending migrations
pnpm run --filter web supabase migrations up
```

##### Creating a New Migration
```bash
# Create a new migration file
pnpm run --filter web supabase migrations new description_of_change
```

#### Database Type Generation
```bash
# Generate Supabase types for client-side use
pnpm run supabase:web:typegen
```

### Best Practices

1. Always generate types after migration changes
2. Use migrations for schema evolution
3. Avoid direct database modifications
4. Test migrations in local environment before production

### Typical Development Workflow

```bash
# Database development process
1. Make schema changes
2. pnpm run --filter web supabase migrations new description_of_change
3. Edit the new migration file
4. pnpm run --filter web supabase migrations up
5. pnpm run supabase:web:typegen
```

### Debugging and Troubleshooting

#### Reset Local Database
```bash
# Reset Supabase database to initial state
pnpm run supabase:web:reset
```

#### Check Supabase Status
```bash
# Verify local Supabase services
pnpm run supabase:web:status
```

#### View Supabase Logs
```bash
# Display Supabase service logs
pnpm run --filter web supabase logs
```

### Production Considerations

- Migrations are version-controlled
- Use `supabase migrations push` for production deployments
- Always backup production database before migrations

### Troubleshooting

#### Migration Conflicts
- Resolve conflicts manually in migration files
- Ensure linear migration history
- Use meaningful, descriptive migration names

#### Type Generation Issues
- Regenerate types after each schema change
- Check for compilation errors
- Verify Supabase CLI and project configuration

### Security Notes

- Never commit sensitive credentials
- Use environment-specific configurations
- Limit database access permissions
