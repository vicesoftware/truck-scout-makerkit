import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Check required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

// After checks, we can assert these are defined
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Initialize Supabase client with admin privileges for test setup
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Regular client for user operations
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

export type TestUser = {
  id?: string;
  email: string;
  password: string;
  role: 'owner' | 'admin' | 'member';
};

export type TestAccount = {
  id: string;
  name: string;
};

/**
 * Creates a test account and user with the specified role
 */
export async function createTestAccountWithUser(user: TestUser): Promise<{ account: TestAccount; user: TestUser }> {
  try {
    console.log('Creating test user:', { email: user.email, role: user.role });

    // First create the user
    const { data: authUser, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true
    });

    if (signUpError) {
      console.error('Error creating user:', signUpError);
      throw signUpError;
    }

    if (!authUser?.user?.id) {
      console.error('No user ID returned from createUser');
      throw new Error('No user ID returned from createUser');
    }

    console.log('Created user:', { id: authUser.user.id, email: authUser.user.email });

    // Create test account with the user as primary owner
    const account: TestAccount = {
      id: uuidv4(),
      name: `Test Account ${uuidv4()}`,
    };

    const accountData = {
      ...account,
      primary_owner_user_id: authUser.user.id,
      slug: `test-account-${account.id}`,
    };

    console.log('Creating account:', accountData);

    const { error: accountError } = await supabaseAdmin
      .from('accounts')
      .insert([accountData]);

    if (accountError) {
      console.error('Error creating account:', accountError);
      throw accountError;
    }

    console.log('Created account:', account);

    // Link user to account with specified role
    const accountUser = {
      user_id: authUser.user.id,
      account_id: account.id,
      role: user.role,
    };

    console.log('Linking user to account:', accountUser);

    const { error: linkError } = await supabaseAdmin
      .from('account_user')
      .insert([accountUser]);

    if (linkError) {
      console.error('Error linking user to account:', linkError);
      throw linkError;
    }

    console.log('Successfully linked user to account');

    return {
      account,
      user: { ...user, id: authUser.user.id },
    };
  } catch (error) {
    console.error('Error in createTestAccountWithUser:', error);
    throw error;
  }
}

/**
 * Creates an authenticated Supabase client for a test user
 */
export async function createAuthenticatedClient(user: TestUser) {
  try {
    console.log('Signing in user:', { email: user.email });

    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });

    if (signInError) {
      console.error('Error signing in:', signInError);
      throw signInError;
    }

    if (!session) {
      console.error('No session returned after sign in');
      throw new Error('No session returned after sign in');
    }

    console.log('Successfully signed in user');

    return createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      }
    );
  } catch (error) {
    console.error('Error in createAuthenticatedClient:', error);
    throw error;
  }
}

/**
 * Verifies if a user has a specific permission
 */
export async function hasPermission(client: any, accountId: string, permission: string): Promise<boolean> {
  try {
    console.log('Checking permission:', { accountId, permission });

    const { data, error } = await client
      .rpc('has_permission', {
        p_permission: permission,
        p_account_id: accountId
      });

    if (error) {
      console.error('Error checking permission:', error);
      throw error;
    }

    console.log('Permission check result:', { hasPermission: data });

    return data || false;
  } catch (error) {
    console.error('Error in hasPermission:', error);
    throw error;
  }
}

/**
 * Cleans up test data for an account
 */
export async function cleanupTestAccount(accountId: string | undefined) {
  if (!accountId) {
    console.log('No account ID provided for cleanup');
    return;
  }

  try {
    console.log('Cleaning up test data for account:', accountId);

    // Delete carriers first due to foreign key constraints
    const { error: carriersError } = await supabaseAdmin
      .from('carriers')
      .delete()
      .eq('account_id', accountId);

    if (carriersError) {
      console.error('Error deleting carriers:', carriersError);
    }

    // Delete factoring companies
    const { error: factoringError } = await supabaseAdmin
      .from('factoring_companies')
      .delete()
      .eq('account_id', accountId);

    if (factoringError) {
      console.error('Error deleting factoring companies:', factoringError);
    }

    // Delete account user associations
    const { error: userError } = await supabaseAdmin
      .from('account_user')
      .delete()
      .eq('account_id', accountId);

    if (userError) {
      console.error('Error deleting account users:', userError);
    }

    // Finally delete the account
    const { error: accountError } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', accountId);

    if (accountError) {
      console.error('Error deleting account:', accountError);
    }

    console.log('Successfully cleaned up test data');
  } catch (error) {
    console.error('Error in cleanupTestAccount:', error);
    throw error;
  }
}

/**
 * Generates test carrier data
 */
export function generateTestCarrier(accountId: string, factoringCompanyId?: string) {
  return {
    account_id: accountId,
    name: `Test Carrier ${uuidv4()}`,
    mc_number: `MC${Math.floor(Math.random() * 1000000)}`,
    contact_info: {
      phone: '555-0123',
      email: `contact-${uuidv4()}@testcarrier.com`,
      address: '123 Test St, Test City, TS 12345'
    },
    rating: 4.5,
    preferred_status: false,
    factoring_company_id: factoringCompanyId
  };
}

/**
 * Generates test factoring company data
 */
export function generateTestFactoringCompany(accountId: string) {
  return {
    account_id: accountId,
    name: `Test Factoring Co ${uuidv4()}`,
    contact_info: {
      phone: '555-0123',
      email: `contact-${uuidv4()}@testfactoring.com`,
      address: '456 Test St, Test City, TS 12345'
    }
  };
}
