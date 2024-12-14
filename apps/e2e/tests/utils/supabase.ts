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
export const supabaseAdmin = createClient(
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
export const supabase = createClient(
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
 * Creates a test account and its primary owner user.
 * This is typically the first step in setting up test data.
 * The owner will have full permissions for the account.
 */
export async function createTestAccountWithUser(user: TestUser): Promise<{ account: TestAccount; user: TestUser }> {
  try {
    // Add delay between user creations to prevent race conditions
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Creating test user:', { email: user.email, role: user.role });

    // First create the user
    const { data: authUser, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true
    });

    if (signUpError) {
      console.error('Error creating user:', signUpError);
      console.error('Detailed error:', JSON.stringify(signUpError, null, 2));
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
      console.error('Detailed error:', JSON.stringify(accountError, null, 2));
      throw accountError;
    }

    console.log('Created account:', account);

    // Link user to account with specified role
    const membership = {
      user_id: authUser.user.id,
      account_id: account.id,
      account_role: user.role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Linking user to account:', membership);

    const { error: linkError } = await supabaseAdmin
      .from('accounts_memberships')
      .insert([membership]);

    if (linkError) {
      console.error('Error linking user to account:', linkError);
      console.error('Detailed error:', JSON.stringify(linkError, null, 2));
      throw linkError;
    }

    console.log('Successfully linked user to account');

    return {
      account,
      user: { ...user, id: authUser.user.id },
    };
  } catch (error) {
    console.error('Error in createTestAccountWithUser:', error);
    console.error('Detailed error:', JSON.stringify(error, null, 2));
    throw error;
  }
}

/**
 * Adds a new user to an existing account with the specified role.
 * Use this when you need additional users (like admins or members) in an account.
 * The user will have permissions based on their role in the account.
 */
export async function addUserToAccount(
  accountId: string,
  user: TestUser
): Promise<TestUser> {
  try {
    console.log('Creating additional user for account:', { accountId, email: user.email, role: user.role });

    // Create the user
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
      throw new Error('No user ID returned');
    }

    // Link user to account
    const membership = {
      user_id: authUser.user.id,
      account_id: accountId,
      account_role: user.role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Adding user to account:', membership);

    const { error: membershipError } = await supabaseAdmin
      .from('accounts_memberships')
      .insert([membership]);

    if (membershipError) {
      console.error('Error adding user to account:', membershipError);
      throw membershipError;
    }

    return { ...user, id: authUser.user.id };
  } catch (error) {
    console.error('Error in addUserToAccount:', error);
    throw error;
  }
}

/**
 * Creates an authenticated Supabase client for a test user.
 * Use this when you need to make API calls as a specific user.
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
 * Verifies if a user has a specific permission in an account.
 * The user must be a member of the account for permissions to work.
 */
export async function hasPermission(client: any, accountId: string, permission: string): Promise<boolean> {
  try {
    console.log('Checking permission:', { accountId, permission });

    const { data, error } = await client
      .rpc('has_permission', {
        p_account_id: accountId,
        p_permission: permission
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
 * Cleans up test data for an account.
 * This will delete all associated data in the correct order to handle foreign key constraints.
 */
export async function cleanupTestAccount(accountId: string | undefined) {
  if (!accountId) {
    console.log('No account ID provided for cleanup');
    return;
  }

  try {
    console.log('Cleaning up test data for account:', accountId);

    // Add delay before cleanup to ensure all operations are complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Delete carriers first due to foreign key constraints
    console.log('Deleting carriers for account:', accountId);
    const { error: carriersError } = await supabaseAdmin
      .from('carriers')
      .delete()
      .eq('account_id', accountId);

    if (carriersError) {
      console.error('Error deleting carriers:', carriersError);
      console.error('Detailed error:', JSON.stringify(carriersError, null, 2));
      throw carriersError;
    }

    // Delete factoring companies
    console.log('Deleting factoring companies for account:', accountId);
    const { error: factoringError } = await supabaseAdmin
      .from('factoring_companies')
      .delete()
      .eq('account_id', accountId);

    if (factoringError) {
      console.error('Error deleting factoring companies:', factoringError);
      console.error('Detailed error:', JSON.stringify(factoringError, null, 2));
      throw factoringError;
    }

    // Delete non-owner account memberships first
    console.log('Deleting account memberships for account:', accountId);
    const { error: membershipError } = await supabaseAdmin
      .from('accounts_memberships')
      .delete()
      .eq('account_id', accountId)
      .neq('account_role', 'owner');

    if (membershipError) {
      console.error('Error deleting account memberships:', membershipError);
      console.error('Detailed error:', JSON.stringify(membershipError, null, 2));
      throw membershipError;
    }

    // Finally delete the account (this will cascade delete the owner membership)
    console.log('Deleting account:', accountId);
    const { error: accountError } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', accountId);

    if (accountError) {
      console.error('Error deleting account:', accountError);
      console.error('Detailed error:', JSON.stringify(accountError, null, 2));
      throw accountError;
    }

    console.log('Successfully cleaned up test data');
  } catch (error) {
    console.error('Error in cleanupTestAccount:', error);
    console.error('Detailed error:', JSON.stringify(error, null, 2));
    throw error;
  }
}

/**
 * Generates test carrier data.
 * Use this to create carriers with valid test data.
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
 * Generates test factoring company data.
 * Use this to create factoring companies with valid test data.
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
