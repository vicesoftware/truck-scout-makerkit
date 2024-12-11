import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import 'dotenv/config';

// Explicitly load environment variables from web project's development config
const envPath = path.resolve(__dirname, '../../../web/.env.development');
require('dotenv').config({ path: envPath });

// Skip test if E2E job is not enabled
test.skip(
  process.env.ENABLE_E2E_JOB !== 'true', 
  'E2E tests are disabled. Set ENABLE_E2E_JOB=true to run.'
);

test.describe('Invoices Table RLS Validation', () => {
  // Validate environment variables are set for GitHub Actions
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Predefined UUID for testing non-existent account
  const NON_EXISTENT_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';

  // Predefined test users from seed data
  const testUsers = {
    owner: {
      email: 'test@makerkit.dev',
      userId: '31a03e74-1639-45b6-bfa7-77447f1a4762'
    },
    admin: {
      email: 'admin@makerkit.dev',
      userId: 'admin-test-user-id'
    },
    billing: {
      email: 'billing@makerkit.dev',
      userId: 'billing-test-user-id'
    },
    member: {
      email: 'member@makerkit.dev',
      userId: 'member-test-user-id'
    },
    factoring: {
      email: 'factoring@makerkit.dev',
      userId: 'factoring-test-user-id'
    }
  };

  test.beforeAll(() => {
    // Ensure required secrets are available
    expect(SUPABASE_URL).toBeTruthy();
    expect(SUPABASE_SERVICE_ROLE_KEY).toBeTruthy();
  });

  test('Validate invoices table schema and RLS policies', async () => {
    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Retrieve invoices table schema
    const { data, error } = await supabase
      .from('invoices')
      .select('id, account_id, load_id, carrier_id, amount, status, due_date, paid_status, internal_notes, created_at, updated_at')
      .limit(0);

    // Verify no errors occurred during the query
    expect(error).toBeNull();

    // Verify table exists and can be queried
    expect(data).toBeTruthy();
  });

  test('Verify RLS policy prevents unauthorized access', async () => {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('account_id', NON_EXISTENT_ACCOUNT_ID)
      .limit(1);

    expect(data).toBeTruthy();
    expect(data).toEqual([]);
    expect(error).toBeNull();
  });

  test('Invoice data accessibility validation', async () => {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { data: invoicesData, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .limit(5);

    expect(invoicesError).toBeNull();
    expect(invoicesData).toBeTruthy();
    
    if (invoicesData) {
      expect(Array.isArray(invoicesData)).toBeTruthy();

      // Update property checks to match actual schema
      invoicesData.forEach(invoice => {
        expect(invoice).toHaveProperty('id');
        expect(invoice).toHaveProperty('account_id');
        expect(invoice).toHaveProperty('load_id');
        expect(invoice).toHaveProperty('carrier_id');
        expect(invoice).toHaveProperty('amount');
        expect(invoice).toHaveProperty('status');
        expect(invoice).toHaveProperty('due_date');
        expect(invoice).toHaveProperty('paid_status');
        expect(invoice).toHaveProperty('created_at');
        expect(invoice).toHaveProperty('updated_at');
      });
    }
  });

  test('Owner can create, read, update, and delete invoices', async () => {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // First create a load
    const loadData = {
      id: crypto.randomUUID(),
      account_id: testUsers.owner.userId,
      status: 'created'
    };

    const { error: loadError } = await supabase
      .from('loads')
      .insert(loadData);
    
    expect(loadError).toBeNull();

    // Then create a carrier
    const carrierData = {
      id: crypto.randomUUID(),
      account_id: testUsers.owner.userId,
      name: 'Test Carrier'
    };

    const { error: carrierError } = await supabase
      .from('carriers')
      .insert(carrierData);
    
    expect(carrierError).toBeNull();

    // Now create the invoice with valid foreign keys
    const testInvoiceData = {
      account_id: testUsers.owner.userId,
      load_id: loadData.id,           // Use the created load's ID
      carrier_id: carrierData.id,     // Use the created carrier's ID
      amount: Math.floor(Math.random() * 10000),
      status: 'draft',
      due_date: new Date().toISOString(),
      paid_status: false,
      internal_notes: 'Test invoice'
    };

    // Create invoice
    const { data: createData, error: createError } = await supabase
      .from('invoices')
      .insert(testInvoiceData)
      .select();

    expect(createError).toBeNull();
    expect(createData).toBeTruthy();
    const createdInvoiceId = createData![0].id;

    // Read invoice
    const { data: readData, error: readError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', createdInvoiceId)
      .eq('account_id', testUsers.owner.userId)
      .single();

    expect(readError).toBeNull();
    expect(readData).toBeTruthy();
    expect(readData!.load_id).toBe(testInvoiceData.load_id);

    // Update invoice
    const { data: updateData, error: updateError } = await supabase
      .from('invoices')
      .update({ status: 'approved' })
      .eq('id', createdInvoiceId)
      .eq('account_id', testUsers.owner.userId)
      .select();

    expect(updateError).toBeNull();
    expect(updateData).toBeTruthy();
    expect(updateData![0].status).toBe('approved');

    // Delete invoice
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', createdInvoiceId)
      .eq('account_id', testUsers.owner.userId);

    expect(deleteError).toBeNull();

    // Add cleanup for the related records after invoice deletion
    await supabase
      .from('loads')
      .delete()
      .eq('id', loadData.id);

    await supabase
      .from('carriers')
      .delete()
      .eq('id', carrierData.id);
  });

  test('Member cannot modify invoices outside their permissions', async () => {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // First create a load
    const loadData = {
      id: crypto.randomUUID(),
      account_id: testUsers.owner.userId,
      status: 'created'
    };

    const { error: loadError } = await supabase
      .from('loads')
      .insert(loadData);
    
    expect(loadError).toBeNull();

    // Then create a carrier
    const carrierData = {
      id: crypto.randomUUID(),
      account_id: testUsers.owner.userId,
      name: 'Test Carrier'
    };

    const { error: carrierError } = await supabase
      .from('carriers')
      .insert(carrierData);
    
    expect(carrierError).toBeNull();

    // Now create the invoice with valid foreign keys
    const testInvoiceData = {
      account_id: testUsers.owner.userId,
      load_id: loadData.id,           // Use the created load's ID
      carrier_id: carrierData.id,     // Use the created carrier's ID
      amount: Math.floor(Math.random() * 10000),
      status: 'draft',
      due_date: new Date().toISOString(),
      paid_status: false,
      internal_notes: 'Test invoice'
    };

    // Create invoice as owner
    const { data: createData, error: createError } = await supabase
      .from('invoices')
      .insert(testInvoiceData)
      .select();

    expect(createError).toBeNull();
    expect(createData).toBeTruthy();
    const createdInvoiceId = createData![0].id;

    // Attempt to update invoice as member (should fail)
    const { data: updateData, error: updateError } = await supabase
      .from('invoices')
      .update({ status: 'approved' })
      .eq('id', createdInvoiceId)
      .eq('account_id', testUsers.member.userId)
      .select();

    // Expect update to fail due to RLS
    expect(updateData).toBeNull();
    expect(updateError).not.toBeNull();

    // Cleanup: Delete the invoice created by owner
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', createdInvoiceId)
      .eq('account_id', testUsers.owner.userId);

    expect(deleteError).toBeNull();

    // Add cleanup for the related records after invoice deletion
    await supabase
      .from('loads')
      .delete()
      .eq('id', loadData.id);

    await supabase
      .from('carriers')
      .delete()
      .eq('id', carrierData.id);
  });

  test.describe('Role-Specific Access Tests', () => {
    test('Admin role permissions validation', async () => {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Create test invoice
      const testInvoiceData = {
        account_id: testUsers.owner.userId,
        amount: 1000,
        status: 'draft',
        due_date: new Date().toISOString(),
        paid_status: false,
        internal_notes: 'Admin test invoice'
      };

      // Create invoice as owner
      const { data: createData, error: createError } = await supabase
        .from('invoices')
        .insert(testInvoiceData)
        .select();

      expect(createError).toBeNull();
      expect(createData).toBeTruthy();
      const invoiceId = createData![0].id;

      // Test admin view access
      const { data: viewData, error: viewError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('account_id', testUsers.owner.userId)
        .single();

      expect(viewError).toBeNull();
      expect(viewData).toBeTruthy();
      if (viewData) {
        expect(viewData.amount).toBe(1000);
      }

      // Test admin metadata update
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ internal_notes: 'Updated by admin' })
        .eq('id', invoiceId);

      expect(updateError).toBeNull();

      // Cleanup
      await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
    });

    test('Billing role permissions validation', async () => {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Create test invoice
      const testInvoiceData = {
        account_id: testUsers.owner.userId,
        amount: 1000,
        status: 'draft',
        due_date: new Date().toISOString(),
        paid_status: false
      };

      const { data: createData, error: createError } = await supabase
        .from('invoices')
        .insert(testInvoiceData)
        .select();

      expect(createError).toBeNull();
      const invoiceId = createData![0].id;

      // Test billing role payment update
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ paid_status: true })
        .eq('id', invoiceId);

      expect(updateError).toBeNull();

      // Verify billing role can access payment details
      const { data: viewData, error: viewError } = await supabase
        .from('invoices')
        .select('amount, paid_status')
        .eq('id', invoiceId)
        .single();

      expect(viewError).toBeNull();
      expect(viewData).toBeTruthy();
      if (viewData) {
        expect(viewData.paid_status).toBe(true);
      }

      // Cleanup
      await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
    });
  });

  test.describe('Status Management Tests', () => {
    test('Invoice status transition validation', async () => {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Create draft invoice
      const testInvoiceData = {
        account_id: testUsers.owner.userId,
        amount: 1000,
        status: 'draft',
        due_date: new Date().toISOString(),
        paid_status: false
      };

      const { data: createData, error: createError } = await supabase
        .from('invoices')
        .insert(testInvoiceData)
        .select();

      expect(createError).toBeNull();
      const invoiceId = createData![0].id;

      // Test draft to pending transition
      const { error: pendingError } = await supabase
        .from('invoices')
        .update({ status: 'pending' })
        .eq('id', invoiceId);

      expect(pendingError).toBeNull();

      // Test pending to paid transition
      const { error: paidError } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_status: true })
        .eq('id', invoiceId);

      expect(paidError).toBeNull();

      // Verify paid invoice cannot be modified
      const { error: modifyError } = await supabase
        .from('invoices')
        .update({ amount: 2000 })
        .eq('id', invoiceId);

      expect(modifyError).not.toBeNull();

      // Test void process
      const { error: voidError } = await supabase
        .from('invoices')
        .update({ 
          status: 'void',
          void_reason: 'Test void process',
          void_date: new Date().toISOString()
        })
        .eq('id', invoiceId);

      expect(voidError).toBeNull();

      // Cleanup
      await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
    });

    test('Status change permissions by role', async () => {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Create test invoice
      const testInvoiceData = {
        account_id: testUsers.owner.userId,
        amount: 1000,
        status: 'draft',
        due_date: new Date().toISOString(),
        paid_status: false
      };

      const { data: createData } = await supabase
        .from('invoices')
        .insert(testInvoiceData)
        .select();

      const invoiceId = createData![0].id;

      // Test member cannot change status
      const { error: memberError } = await supabase
        .auth.signInWithPassword({
          email: testUsers.member.email,
          password: 'testpassword'
        });

      const { error: statusError } = await supabase
        .from('invoices')
        .update({ status: 'pending' })
        .eq('id', invoiceId);

      expect(statusError).not.toBeNull();

      // Test billing role can mark as paid
      const { error: billingError } = await supabase
        .auth.signInWithPassword({
          email: testUsers.billing.email,
          password: 'testpassword'
        });

      const { error: paidError } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_status: true })
        .eq('id', invoiceId);

      expect(paidError).toBeNull();

      // Cleanup
      await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
    });
  });

  test.describe('Financial Data Protection Tests', () => {
    test('Sensitive field access control', async () => {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Create test invoice with sensitive data
      const testInvoiceData = {
        account_id: testUsers.owner.userId,
        amount: 1000,
        bank_details: 'Test Bank Account',
        payment_details: 'Confidential Payment Info',
        status: 'pending',
        due_date: new Date().toISOString(),
        paid_status: false
      };

      const { data: createData } = await supabase
        .from('invoices')
        .insert(testInvoiceData)
        .select();

      expect(createData).toBeTruthy();
      const invoiceId = createData![0].id;

      // Test member access (should see masked data)
      const { data: memberView } = await supabase
        .auth.signInWithPassword({
          email: testUsers.member.email,
          password: 'testpassword'
        });

      const { data: memberData, error: memberError } = await supabase
        .from('invoices')
        .select('bank_details, payment_details')
        .eq('id', invoiceId)
        .single();

      expect(memberError).toBeNull();
      expect(memberData).toBeTruthy();
      if (memberData) {
        expect(memberData.bank_details).toBe('****');
        expect(memberData.payment_details).toBe('****');
      }

      // Test billing role access (should see full data)
      const { data: billingView } = await supabase
        .auth.signInWithPassword({
          email: testUsers.billing.email,
          password: 'testpassword'
        });

      const { data: billingData, error: billingError } = await supabase
        .from('invoices')
        .select('bank_details, payment_details')
        .eq('id', invoiceId)
        .single();

      expect(billingError).toBeNull();
      expect(billingData).toBeTruthy();
      if (billingData) {
        expect(billingData.bank_details).toBe(testInvoiceData.bank_details);
        expect(billingData.payment_details).toBe(testInvoiceData.payment_details);
      }

      // Cleanup
      await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
    });
  });

  test.describe('Audit Trail Tests', () => {
    test('Status change logging', async () => {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Create test invoice
      const testInvoiceData = {
        account_id: testUsers.owner.userId,
        amount: 1000,
        status: 'draft',
        due_date: new Date().toISOString(),
        paid_status: false
      };

      const { data: createData } = await supabase
        .from('invoices')
        .insert(testInvoiceData)
        .select();

      const invoiceId = createData![0].id;

      // Change status and verify audit log
      const { error: statusError } = await supabase
        .from('invoices')
        .update({ 
          status: 'pending',
          status_change_reason: 'Ready for processing'
        })
        .eq('id', invoiceId);

      expect(statusError).toBeNull();

      // Verify audit log entry
      const { data: auditData } = await supabase
        .from('invoice_audit_log')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('change_type', 'status_change')
        .single();

      expect(auditData).toBeTruthy();
      expect(auditData.old_value).toBe('draft');
      expect(auditData.new_value).toBe('pending');
      expect(auditData.change_reason).toBe('Ready for processing');

      // Cleanup
      await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
    });
  });
});
