import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';

// Explicitly load environment variables from web project's development config
const envPath = path.resolve(__dirname, '../../../web/.env.development');
require('dotenv').config({ path: envPath });

// Skip test if E2E job is not enabled
test.skip(
  process.env.ENABLE_E2E_JOB !== 'true', 
  'E2E tests are disabled. Set ENABLE_E2E_JOB=true to run.'
);

test.describe('User Authentication', () => {
  // Validate environment variables are set for GitHub Actions
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  test.beforeAll(() => {
    // Ensure required secrets are available
    console.log('Supabase URL:', SUPABASE_URL);
    console.log('Supabase Service Role Key:', SUPABASE_SERVICE_ROLE_KEY);
    
    expect(SUPABASE_URL).toBeTruthy();
    expect(SUPABASE_SERVICE_ROLE_KEY).toBeTruthy();
  });

  // Predefined test user matching seed data
  const testUser = {
    email: 'test@makerkit.dev',
    userId: '31a03e74-1639-45b6-bfa7-77447f1a4762'
  };

  test('validate user context and account membership', async () => {
    // Initialize Supabase client with service role for admin access
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Retrieve user information
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(testUser.userId);

    console.log('User Data:', JSON.stringify(userData, null, 2));
    console.log('User Error:', JSON.stringify(userError, null, 2));

    // Validate user exists and has correct email
    expect(userError).toBeNull();
    expect(userData?.user).toBeTruthy();
    
    // Non-null assertion after checking truthy
    const user = userData!.user!;
    expect(user.email).toBe(testUser.email);

    // Check account membership
    const { data: membershipData, error: membershipError } = await supabase
      .from('accounts_memberships')
      .select('account_role')
      .eq('user_id', testUser.userId)
      .single();

    console.log('Membership Data:', JSON.stringify(membershipData, null, 2));
    console.log('Membership Error:', JSON.stringify(membershipError, null, 2));

    // Validate account membership
    expect(membershipError).toBeNull();
    
    // Non-null assertion after checking error is null
    const membership = membershipData!;
    expect(membership.account_role).toBeDefined();
    expect(['owner', 'member', 'custom-role']).toContain(membership.account_role);
  });
});
