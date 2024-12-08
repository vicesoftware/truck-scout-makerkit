# Row-Level Security (RLS) Requirements for TruckingApp <!-- omit in toc -->

This document outlines the objectives, scope, and initial requirements for implementing Row-Level Security (RLS) in the TruckingApp database schema.

---

- [**1. Objectives**](#1-objectives)
- [**2. Scope**](#2-scope)
  - [**High-Priority Tables**](#high-priority-tables)
- [**3. Data Ownership**](#3-data-ownership)
  - [**Ownership Logic**](#ownership-logic)
- [**4. User Roles and Permissions**](#4-user-roles-and-permissions)
  - [**Defined Roles**](#defined-roles)
- [**5. Next Steps**](#5-next-steps)


## **1. Objectives**

The implementation of RLS in TruckingApp aims to:

1. **Protect Multi-Tenant Data**:
   - Ensure that data is only accessible to users within the same tenant (e.g., accounts).
   - Prevent unauthorized access to sensitive data across tenants.

2. **Enforce Role-Based Access Control (RBAC)**:
   - Implement granular permissions for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` operations.
   - Restrict actions based on predefined user roles: `Owner`, `Admin`, `Member`, `Service Role`.

3. **Streamline Application Logic**:
   - Move access control to the database layer to simplify application logic.
   - Ensure consistent enforcement of access policies across all entry points.

4. **Enhance Security**:
   - Limit the exposure of sensitive data through robust, database-enforced policies.
   - Reduce the risk of accidental or malicious data access.

---

## **2. Scope**

RLS will initially focus on the following schemas and tables:

### **High-Priority Tables**

1. **`public.accounts`**:
   - Core table linking all tenant-related data.
   - Ownership defined by `primary_owner_user_id` or memberships in `accounts_memberships`.

2. **`trucking.loads`**:
   - Represents freight loads, including origin, destination, and assigned carriers.
   - Access determined by the `account_id` field.

3. **`trucking.drivers`**:
   - Contains sensitive driver information (e.g., license numbers, contact info).
   - Ownership linked to `account_id`.

4. **`kit.documents`**:
   - Stores uploaded documents linked to entities like loads, carriers, and drivers.
   - Access tied to the `account_id` of the associated entity.

---

## **3. Data Ownership**

### **Ownership Logic**

- **Account-Based**:
  - Most entities (e.g., `loads`, `drivers`) are linked to an account via the `account_id` field.
  - Access is granted to users with roles associated with the owning account.

- **Relationship-Based**:
  - Some entities (e.g., `drivers`, `vehicles`) are linked indirectly through relationships:
    - Example: A `driver` belongs to a `carrier`, which belongs to an `account`.

---

# User Types for TruckingApp

This document outlines the different types of users in the TruckingApp application, based on the domain requirements and database schema. These roles guide the implementation of access control policies, including Row-Level Security (RLS).

---

## **1. Account Owners (Business Administrators)**

### **Description**
- Users who own or manage the business account.
- Typically small business owners or trucking company managers.

### **Responsibilities**
- Full access to all account data and operations.
- Manage account settings, including billing and user roles.
- Oversee logistics and operational tasks.

### **Access Needs**
- **Entities**: All entities tied to their account.
- **Permissions**: `SELECT`, `INSERT`, `UPDATE`, `DELETE` for all account-related data.

---

## **2. Dispatchers (Operational Managers)**

### **Description**
- Users responsible for managing day-to-day logistics and loads.
- Act as the bridge between carriers, drivers, and operations.

### **Responsibilities**
- Assign loads to drivers and carriers.
- Monitor delivery progress and update load statuses.
- Manage vehicle maintenance logs.

### **Access Needs**
- **Entities**: Loads, carriers, drivers, vehicles, and maintenance logs.
- **Permissions**:
  - `SELECT`: Access account-related data.
  - `INSERT`: Create and assign loads.
  - `UPDATE`: Modify load statuses and assignments.
  - `DELETE`: Remove unassigned loads.

---

## **3. Drivers (Field Operators)**

### **Description**
- Users responsible for executing freight deliveries.

### **Responsibilities**
- View and execute assigned loads.
- Submit delivery updates and upload required documents.

### **Access Needs**
- **Entities**: Assigned loads, related documents, and updates.
- **Permissions**:
  - `SELECT`: View assigned loads and related data.
  - `INSERT`: Submit delivery status updates and upload documents.
  - **Restrictions**:
    - No access to other drivers’ or global account data.

---

## **4. Billing Contacts (Finance Specialists)**

### **Description**
- Users focused on financial operations and invoice management.

### **Responsibilities**
- Access and manage account-related invoices and payments.
- Resolve payment issues and track billing statuses.

### **Access Needs**
- **Entities**: Invoices and payments.
- **Permissions**:
  - `SELECT`: View invoices and payment information.
  - `UPDATE`: Modify invoice statuses (e.g., mark as paid).
  - **Restrictions**:
    - Limited access to operational or non-financial data.

---

## **5. Service Role (Internal/Automated Users)**

### **Description**
- Roles used by system-level processes or APIs for automation.

### **Responsibilities**
- Handle automated tasks like ticket creation, analytics generation, and data synchronization.

### **Access Needs**
- **Entities**: Varies based on the automation requirements.
- **Permissions**:
  - `INSERT`, `UPDATE`: Perform specific automated tasks.
  - `SELECT`: Minimal access to essential data for operations.
  - **Restrictions**:
    - No interactive or unrestricted database access.

---

## **6. Factoring Company Representatives (External Role)**

### **Description**
- External users related to invoice financing for trucking companies.

### **Responsibilities**
- View invoices linked to their factoring agreements.
- Coordinate with account owners for invoice payments.

### **Access Needs**
- **Entities**: Invoices related to their factoring agreements.
- **Permissions**:
  - `SELECT`: Access specific invoice data.
  - **Restrictions**:
    - No access to non-financial or unrelated account data.

---

## **Next Steps**

1. Validate these user types with stakeholders to ensure alignment with application requirements.
2. Incorporate these roles into Row-Level Security (RLS) policies and access control logic.
3. Create detailed role-based permissions for critical entities.



---

# **5. Next Steps**

1. **Draft Policy Blueprints**:
   - Write pseudocode for RLS policies for `public.accounts`.

2. **Validate Ownership Rules**:
   - Review edge cases where ownership may be ambiguous (e.g., shared resources).

3. **Collaborate on Implementation**:
   - Transition to SQL-level implementation with Cline after requirements are validated.

---

This document serves as the foundation for RLS implementation and will be updated as new requirements are identified.
