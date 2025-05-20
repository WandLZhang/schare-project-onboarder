// Interfaces for IAM resources

// Service Account interface
export interface ServiceAccount {
  name: string; // projects/{PROJECT_ID}/serviceAccounts/{UNIQUE_ID}
  projectId: string;
  uniqueId: string;
  email: string; // {ACCOUNT_ID}@{PROJECT_ID}.iam.gserviceaccount.com
  displayName?: string;
  disabled?: boolean;
  createTime?: string;
}

// IAM Policy interface
export interface Policy {
  version?: number;
  bindings?: Binding[];
  etag?: string;
}

// IAM Policy Binding interface
export interface Binding {
  role: string; // e.g., "roles/aiplatform.user"
  members?: string[]; 
  condition?: Expr; // Optional, for conditional bindings
}

// Conditional Expression interface
export interface Expr {
  expression?: string;
  title?: string;
  description?: string;
  location?: string;
}

// Function to get the IAM policy for a project
export const getProjectIamPolicy = async (
  accessToken: string,
  projectId: string
): Promise<Policy> => {
  try {
    const response = await fetch(`https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}:getIamPolicy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        options: {
          requestedPolicyVersion: 3
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Error getting IAM policy: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting project IAM policy:', error);
    throw error;
  }
};

// Function to set the IAM policy for a project
export const setProjectIamPolicy = async (
  accessToken: string,
  projectId: string,
  policy: Policy
): Promise<Policy> => {
  try {
    const response = await fetch(`https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}:setIamPolicy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        policy: policy,
        updateMask: 'bindings'
      })
    });

    if (!response.ok) {
      throw new Error(`Error setting IAM policy: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error setting project IAM policy:', error);
    throw error;
  }
};

// Function to list all service accounts in a project
export const listServiceAccounts = async (
  accessToken: string,
  projectId: string
): Promise<ServiceAccount[]> => {
  try {
    const response = await fetch(`https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error listing service accounts: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.accounts || [];
  } catch (error) {
    console.error('Error listing service accounts:', error);
    throw error;
  }
};

// Function to create a service account
export const createServiceAccount = async (
  accessToken: string,
  projectId: string,
  accountId: string,
  displayName: string
): Promise<ServiceAccount> => {
  try {
    const response = await fetch(`https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountId: accountId,
        serviceAccount: {
          displayName: displayName
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error creating service account: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating service account:', error);
    throw error;
  }
};

// Function to grant the Vertex AI User role to a service account
export const grantVertexAIUserRoleToServiceAccount = async (
  accessToken: string,
  projectId: string,
  serviceAccountEmail: string
): Promise<void> => {
  try {
    // Get the current IAM policy
    const policy = await getProjectIamPolicy(accessToken, projectId);
    
    // Find or create the binding for the Vertex AI User role
    const vertexAIUserRole = 'roles/aiplatform.user';
    let binding = policy.bindings?.find(b => b.role === vertexAIUserRole);
    
    if (binding) {
      // Add the service account to the existing binding if not already present
      const memberKey = `serviceAccount:${serviceAccountEmail}`;
      if (!binding.members?.includes(memberKey)) {
        binding.members = [...(binding.members || []), memberKey];
      }
    } else {
      // Create a new binding for the role
      const newBinding = {
        role: vertexAIUserRole,
        members: [`serviceAccount:${serviceAccountEmail}`]
      };
      
      policy.bindings = [...(policy.bindings || []), newBinding];
    }
    
    // Update the IAM policy
    await setProjectIamPolicy(accessToken, projectId, policy);
  } catch (error) {
    console.error('Error granting Vertex AI User role:', error);
    throw error;
  }
};

// Function to get the IAM policy for a service account
export const getServiceAccountIamPolicy = async (
  accessToken: string,
  projectId: string,
  serviceAccountEmail: string
): Promise<Policy> => {
  try {
    const response = await fetch(`https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts/${serviceAccountEmail}:getIamPolicy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        options: {
          requestedPolicyVersion: 3
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Error getting service account IAM policy: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting service account IAM policy:', error);
    throw error;
  }
};

// Function to set the IAM policy for a service account
export const setServiceAccountIamPolicy = async (
  accessToken: string,
  projectId: string,
  serviceAccountEmail: string,
  policy: Policy
): Promise<Policy> => {
  try {
    const response = await fetch(`https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts/${serviceAccountEmail}:setIamPolicy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        policy: policy,
        updateMask: 'bindings'
      })
    });

    if (!response.ok) {
      throw new Error(`Error setting service account IAM policy: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error setting service account IAM policy:', error);
    throw error;
  }
};

// Function to grant a role to a user on a specific service account
export const grantUserRoleOnServiceAccount = async (
  accessToken: string,
  projectId: string,
  serviceAccountEmail: string,
  userEmail: string,
  role: string // e.g., 'roles/iam.serviceAccountUser'
): Promise<void> => {
  try {
    // Get the current IAM policy for the service account
    const policy = await getServiceAccountIamPolicy(accessToken, projectId, serviceAccountEmail);
    
    // Find or create the binding for the specified role
    let binding = policy.bindings?.find(b => b.role === role);
    
    if (binding) {
      // Add the user to the existing binding if not already present
      const memberKey = `user:${userEmail}`;
      if (!binding.members?.includes(memberKey)) {
        binding.members = [...(binding.members || []), memberKey];
      }
    } else {
      // Create a new binding for the role
      const newBinding = {
        role: role,
        members: [`user:${userEmail}`]
      };
      
      policy.bindings = [...(policy.bindings || []), newBinding];
    }
    
    // Update the IAM policy for the service account
    await setServiceAccountIamPolicy(accessToken, projectId, serviceAccountEmail, policy);
  } catch (error) {
    console.error(`Error granting ${role} to user ${userEmail}:`, error);
    throw error;
  }
};

// Function to list service accounts with the Vertex AI User role
export const listServiceAccountsWithVertexAIRole = async (
  accessToken: string,
  projectId: string
): Promise<ServiceAccount[]> => {
  try {
    // Get the project IAM policy
    const policy = await getProjectIamPolicy(accessToken, projectId);
    
    // Find the binding for the Vertex AI User role
    const vertexAIUserRole = 'roles/aiplatform.user';
    const binding = policy.bindings?.find(b => b.role === vertexAIUserRole);
    
    if (!binding || !binding.members || binding.members.length === 0) {
      return [];
    }
    
    // Filter for service account members
    const serviceAccountMembers = binding.members
      .filter(member => member.startsWith('serviceAccount:'))
      .map(member => member.replace('serviceAccount:', ''));
    
    if (serviceAccountMembers.length === 0) {
      return [];
    }
    
    // Get all service accounts in the project
    const allServiceAccounts = await listServiceAccounts(accessToken, projectId);
    
    // Filter to only include service accounts with the Vertex AI User role
    return allServiceAccounts.filter(sa => 
      serviceAccountMembers.includes(sa.email) && !sa.disabled
    );
  } catch (error) {
    console.error('Error listing service accounts with Vertex AI User role:', error);
    throw error;
  }
};
