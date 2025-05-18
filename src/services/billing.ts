import { deleteProject } from './projects';

// Interface for GCP Billing Account
export interface BillingAccount {
  name: string;
  open: boolean;
  displayName: string;
  masterBillingAccount?: string;
}

// Get token info when needed
export const getTokenInfo = async (accessToken: string): Promise<any> => {
  try {
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
    console.error('Error getting token info:', error);
    return null;
  }
};

// Interface for TestIamPermissionsResponse
interface TestIamPermissionsResponse {
  permissions: string[];
}

// Interface for IamPolicy
interface IamPolicy {
  version: number;
  etag: string;
  bindings: {
    role: string;
    members: string[];
  }[];
}

// Function to list billing accounts
export const listBillingAccounts = async (accessToken: string): Promise<BillingAccount[]> => {
  try {
    // Optional debug - log token info for debugging
    const tokenInfo = await getTokenInfo(accessToken);
    
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

// Function to get the Billing Account IAM Policy directly from Google Cloud Billing API
export const getBillingAccountIamPolicy = async (
  accessToken: string,
  billingAccountName: string
): Promise<{ policy: IamPolicy; billingAdminMembers: string[] }> => {
  try {
    console.log(`Fetching IAM policy for billing account: ${billingAccountName} directly from API`);
    
    const response = await fetch(`https://cloudbilling.googleapis.com/v1/${billingAccountName}:getIamPolicy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}) // Empty body is required for this API
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to get IAM policy: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Error fetching IAM policy: ${response.status} ${response.statusText}`);
    }

    const policy = await response.json();
    console.log('Retrieved IAM policy directly from API');
    
    // Extract billing admin members from policy
    let billingAdminMembers: string[] = [];
    if (policy.bindings) {
      for (const binding of policy.bindings) {
        if (binding.role === 'roles/billing.admin' || binding.role === 'roles/billing.administrator') {
          billingAdminMembers = billingAdminMembers.concat(binding.members);
        }
      }
    }
    
    // Log the billing administrators for debugging
    if (billingAdminMembers.length > 0) {
      console.log('Billing Administrator members:', billingAdminMembers);
    } else {
      console.log('No Billing Administrator members found in the policy');
    }
    
    return {
      policy,
      billingAdminMembers
    };
  } catch (error) {
    console.error(`Error getting IAM policy for ${billingAccountName}:`, error);
    throw error;
  }
};

// Function to link a billing account to a project - direct API call
export const linkBillingAccountDirect = async (
  accessToken: string,
  projectId: string,
  billingAccountName: string
): Promise<void> => {
  try {
    console.log(`Linking project ${projectId} to billing account ${billingAccountName} (direct API call)`);
    
    const requestBody = {
      billingAccountName,
      billingEnabled: true
    };
    
    console.log('Billing link request body:', JSON.stringify(requestBody));
    
    // Debug token info to better understand permissions
    const tokenInfo = await getTokenInfo(accessToken);
    console.log('Token info for billing link operation:', tokenInfo);
    
    // Get email from token info for comparison
    const userEmail = tokenInfo?.email || '';
    console.log(`User email from token: ${userEmail}`);
    
    // Execute the billing linkage operation
    const response = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // Get the response text for better error logging
    const responseText = await response.text();
    console.log(`Billing link response for project ${projectId}:`, response.status, responseText);
    
    
    if (!response.ok) {
      let errorMessage: string;
      
      if (response.status === 403) {
        // Provide guidance about permissions
        const permissionMessage = `
Permission denied (403) when linking project ${projectId} to billing account ${billingAccountName}.

This typically means your Google account needs one of these IAM roles on the billing account:
1. Billing Account Administrator
2. Billing Account User (with additional Project Creator/Owner roles)
`;
        console.error(permissionMessage);
        errorMessage = `Error linking billing account: Permission denied (403). You need Billing Account Administrator or Billing Account User role on ${billingAccountName}.`;
      } else {
        console.error(`Error linking project ${projectId} to billing account: ${response.status} ${response.statusText} - ${responseText}`);
        errorMessage = `Error linking billing account: ${response.status} ${response.statusText}`;
      }
      
      // Throw an error to be caught by the catch block below
      throw new Error(errorMessage);
    }
    
    console.log(`Successfully linked project ${projectId} to billing account ${billingAccountName}`);
  } catch (error: any) {
    console.error('Error linking billing account (direct API call):', error);
    
    // Attempt to delete the project since billing linkage failed
    console.log(`Billing linkage failed for project ${projectId}, attempting to delete the project...`);
    try {
      await deleteProject(accessToken, projectId);
      console.log(`Successfully deleted project ${projectId} after billing linkage failure`);
      
      // Throw a composite error that includes the deletion information
      throw new Error(`${error.message || 'Unknown billing linkage error'}. The project ${projectId} has been deleted due to billing linkage failure.`);
    } catch (deleteError: any) {
      console.error(`Failed to delete project ${projectId} after billing linkage failure:`, deleteError);
      
      // Throw a composite error that includes both the original error and deletion failure
      throw new Error(`${error.message || 'Unknown billing linkage error'}. Additionally, failed to delete the project after billing linkage failure: ${deleteError.message || 'unknown error'}`);
    }
  }
};

// Function to link a billing account to a project (now using direct API call)
export const linkBillingAccount = async (
  accessToken: string,
  projectId: string,
  billingAccountName: string
): Promise<void> => {
  try {
    console.log(`Linking project ${projectId} to billing account ${billingAccountName} via direct API call`);
    
    // Use the existing direct API function instead of the Cloud Function
    await linkBillingAccountDirect(accessToken, projectId, billingAccountName);
    
    console.log(`Successfully linked project ${projectId} to billing account ${billingAccountName}`);
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

// Function to check if current user has Billing Account Admin role
export const checkIfUserIsBillingAdmin = async (
  accessToken: string,
  billingAccountName: string
): Promise<boolean> => {
  try {
    // These permissions are only available to Billing Account Administrators
    const adminOnlyPermissions = [
      'billing.accounts.update', 
      'billing.accounts.getIamPolicy', 
      'billing.accounts.setIamPolicy'
    ];
    
    const grantedPermissions = await testBillingAccountPermissions(
      accessToken,
      billingAccountName,
      adminOnlyPermissions
    );
    
    // If user has all these permissions, they are likely a Billing Account Admin
    const isAdmin = grantedPermissions.length === adminOnlyPermissions.length;
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Function to get user email from token 
export const getAdministratorEmail = async (
  accessToken: string,
  billingAccountName: string
): Promise<string | null> => {
  try {
    // Get email from token
    const tokenInfo = await getTokenInfo(accessToken);
    const currentUserEmail = tokenInfo?.email;
    
    if (!currentUserEmail) {
      console.error('Could not get current user email from token');
      return null;
    }
    
    // Check if current user is an admin
    const isAdmin = await checkIfUserIsBillingAdmin(accessToken, billingAccountName);
    
    if (isAdmin) {
      return currentUserEmail;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting administrators:', error);
    return null;
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
