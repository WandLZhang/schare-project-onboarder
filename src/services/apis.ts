// Interface for Service (API)
export interface Service {
  name: string;
  config: {
    name: string;
    title: string;
    documentation?: {
      summary: string;
    };
  };
  state: 'ENABLED' | 'DISABLED' | string;
}

// Function to enable an API for a project
export const enableApi = async (
  accessToken: string,
  projectId: string,
  apiName: string
): Promise<void> => {
  try {
    const response = await fetch(`https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${apiName}:enable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error enabling API: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Error enabling API ${apiName}:`, error);
    throw error;
  }
};

// Function to check if an API is enabled
export const checkApiEnabled = async (
  accessToken: string,
  projectId: string,
  apiName: string
): Promise<boolean> => {
  try {
    const response = await fetch(`https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${apiName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error checking API status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.state === 'ENABLED';
  } catch (error) {
    console.error(`Error checking if API ${apiName} is enabled:`, error);
    throw error;
  }
};

// Function to list enabled APIs
export const listEnabledApis = async (
  accessToken: string,
  projectId: string
): Promise<Service[]> => {
  try {
    const response = await fetch(`https://serviceusage.googleapis.com/v1/projects/${projectId}/services?filter=state:ENABLED`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error listing enabled APIs: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.services || [];
  } catch (error) {
    console.error('Error listing enabled APIs:', error);
    throw error;
  }
};

// Common APIs needed for Vertex AI and other GCP services
export const REQUIRED_APIS = [
  'aiplatform.googleapis.com',          // Vertex AI API
  'iam.googleapis.com',                 // Identity and Access Management (IAM) API
  'iamcredentials.googleapis.com',      // IAM Service Account Credentials API
  'cloudresourcemanager.googleapis.com', // Cloud Resource Manager API
  'cloudbilling.googleapis.com',        // Cloud Billing API
  'serviceusage.googleapis.com'         // Service Usage API
];

// Function to enable all required APIs
export const enableRequiredApis = async (
  accessToken: string,
  projectId: string,
  onProgress?: (api: string, index: number, total: number) => void
): Promise<void> => {
  for (let i = 0; i < REQUIRED_APIS.length; i++) {
    const api = REQUIRED_APIS[i];
    if (onProgress) {
      onProgress(api, i, REQUIRED_APIS.length);
    }
    await enableApi(accessToken, projectId, api);
  }
};
