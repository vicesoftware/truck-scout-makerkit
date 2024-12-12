# Database Schema for TruckingApp

This document contains the DBML representation of the database schema for the TruckingApp. Two versions of the schema are provided:
1. A **version with schemas** to organize tables into logical groupings.
2. A **version without schemas** for tools that do not support schema definitions.

## **Schemas Overview**

| Schema Name | Description                                                                                   |
|-------------|-----------------------------------------------------------------------------------------------|
| `auth`      | Manages user authentication and Supabase integration.                                         |
| `public`    | Core functionality including multi-tenancy, SaaS features, and domain-specific trucking entities. |
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
| `vehicles`           | Manages vehicles, including their VIN, license plate, and maintenance status.           |
| `maintenance_logs`   | Logs maintenance activities performed on vehicles.                                      |
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

Table public.maintenance_logs {
  id UUID [pk]
  vehicle_id UUID [ref: > public.vehicles.id]
  description TEXT
  performed_at TIMESTAMP
  cost DECIMAL(10, 2)
  created_at TIMESTAMP
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
  amount DECIMAL(10,2)
  due_date TIMESTAMP
  paid_status BOOLEAN
  created_at TIMESTAMP
  updated_at TIMESTAMP
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

Table maintenance_logs {
  id UUID [pk]
  vehicle_id UUID [ref: > vehicles.id]
  description TEXT
  performed_at TIMESTAMP
  cost DECIMAL(10, 2)
  created_at TIMESTAMP
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
  amount DECIMAL(10,2)
  due_date TIMESTAMP
  paid_status BOOLEAN
  created_at TIMESTAMP
  updated_at TIMESTAMP
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
