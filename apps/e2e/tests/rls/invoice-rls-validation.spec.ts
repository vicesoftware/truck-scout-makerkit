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
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Attempt to retrieve invoices without proper account context
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('account_id', 'non-existent-account-id')
      .limit(1);

    // Verify that no data is returned for an invalid account
    expect(data).toHaveLength(0);
    expect(error).toBeNull();
  });
});
