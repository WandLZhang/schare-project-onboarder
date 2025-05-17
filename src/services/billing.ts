// Interface for GCP Billing Account
export interface BillingAccount {
  name: string;
  open: boolean;
  displayName: string;
  masterBillingAccount?: string;
}

// For debugging purposes
export const debugTokenInfo = async (accessToken: string): Promise<any> => {
  try {
    // This endpoint helps debug token info
    const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      console.error(`Token validation failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error checking token info:', error);
    return null;
  }
};

// Interface for TestIamPermissionsResponse
interface TestIamPermissionsResponse {
  permissions: string[];
}

// Function to list billing accounts
export const listBillingAccounts = async (accessToken: string): Promise<BillingAccount[]> => {
  try {
    // Optional debug - log token info for debugging
    const tokenInfo = await debugTokenInfo(accessToken);
    console.log('Token info used for billing API:', tokenInfo);
    
    const response = await fetch('https://cloudbilling.googleapis.com/v1/billingAccounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Response status: ${response.status}, Text: ${response.statusText}`);
      const errorBody = await response.text();
      console.error('Error response body:', errorBody);
      throw new Error(`Error fetching billing accounts: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.billingAccounts || [];
  } catch (error) {
    console.error('Error listing billing accounts:', error);
    throw error;
  }
};

// Function to get a billing account
export const getBillingAccount = async (accessToken: string, name: string): Promise<BillingAccount> => {
  try {
    const response = await fetch(`https://cloudbilling.googleapis.com/v1/${name}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error fetching billing account: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting billing account:', error);
    throw error;
  }
};

// Function to link a billing account to a project
export const linkBillingAccount = async (
  accessToken: string,
  projectId: string,
  billingAccountName: string
): Promise<void> => {
  try {
    const response = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        billingAccountName,
        billingEnabled: true
      })
    });

    if (!response.ok) {
      throw new Error(`Error linking billing account: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error linking billing account:', error);
    throw error;
  }
};

// Get billing info for a project
export const getProjectBillingInfo = async (accessToken: string, projectId: string): Promise<any> => {
  try {
    const response = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error fetching project billing info: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting project billing info:', error);
    throw error;
  }
};

// Function to test IAM permissions for a specific billing account
export const testBillingAccountPermissions = async (
  accessToken: string,
  billingAccountName: string,
  permissions: string[]
): Promise<string[]> => {
  try {
    const response = await fetch(`https://cloudbilling.googleapis.com/v1/${billingAccountName}:testIamPermissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        permissions
      })
    });

    if (!response.ok) {
      throw new Error(`Error testing permissions for ${billingAccountName}: ${response.status} ${response.statusText}`);
    }

    const data: TestIamPermissionsResponse = await response.json();
    return data.permissions || [];
  } catch (error) {
    console.error(`Error testing permissions for ${billingAccountName}:`, error);
    throw error;
  }
};

// Function to get billing accounts where the user has the billing.resourceAssociations.create permission
export const getBillingAccountsWithCreatePermission = async (accessToken: string): Promise<BillingAccount[]> => {
  try {
    console.log('Fetching billing accounts with create permission');
    // First, get all billing accounts the user can see
    const allBillingAccounts = await listBillingAccounts(accessToken);
    
    if (allBillingAccounts.length === 0) {
      console.log('No billing accounts found');
      return [];
    }
    
    // For each billing account, check if the user has the required permission
    const accountsWithPermissions = await Promise.all(
      allBillingAccounts.map(async (account) => {
        try {
          const grantedPermissions = await testBillingAccountPermissions(
            accessToken,
            account.name,
            ['billing.resourceAssociations.create']
          );
          
          // If the user has the required permission, return the account, otherwise return null
          return grantedPermissions.includes('billing.resourceAssociations.create') ? account : null;
        } catch (error) {
          console.error(`Error checking permissions for ${account.name}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null values (accounts without the required permission)
    const filteredAccounts = accountsWithPermissions.filter(account => account !== null) as BillingAccount[];
    console.log(`Found ${filteredAccounts.length} billing accounts with create permission`);
    
    return filteredAccounts;
  } catch (error) {
    console.error('Error getting billing accounts with create permission:', error);
    throw error;
  }
};

// Function to list projects linked to a billing account
export const listProjectsForBillingAccount = async (
  accessToken: string, 
  billingAccountName: string
): Promise<any[]> => {
  try {
    const response = await fetch(`https://cloudbilling.googleapis.com/v1/${billingAccountName}/projects`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error fetching projects for billing account: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.projectBillingInfo || [];
  } catch (error) {
    console.error('Error listing projects for billing account:', error);
    throw error;
  }
};
