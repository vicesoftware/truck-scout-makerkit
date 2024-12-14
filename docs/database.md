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

## Database Schema

See the [Database Schema](/docs/database-schema.md) for the full version with schemas.
