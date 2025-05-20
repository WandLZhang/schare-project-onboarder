import { getCurrentUser } from './auth';

// List of essential APIs to enable for new projects
export const ESSENTIAL_APIS = [
  'serviceusage.googleapis.com',     // Service Usage API (needed to enable other APIs)
  'cloudresourcemanager.googleapis.com', // Cloud Resource Manager API
  'cloudbilling.googleapis.com',     // Cloud Billing API
  'aiplatform.googleapis.com',       // Vertex AI API
];

// Interface for GCP Project
export interface GCPProject {
  projectId: string;
  name: string;
  projectNumber: string;
  createTime: string;
  lifecycleState: string;  // Changed from 'state' to match the API response
}

// Function to list all GCP projects accessible to the user
export const listProjects = async (accessToken: string): Promise<GCPProject[]> => {
  try {
    const response = await fetch('https://cloudresourcemanager.googleapis.com/v1/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error fetching projects: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.projects || [];
  } catch (error) {
    console.error('Error listing projects:', error);
    throw error;
  }
};

// Function to create a new GCP project
export const createProject = async (
  accessToken: string, 
  projectId: string, 
  name: string
): Promise<GCPProject> => {
  try {
    // Log the request details
    console.log('Creating project with:', { projectId, name });
    
    // Using v3 endpoint
    const requestBody = {
      projectId,
      displayName: name,
    };
    
    console.log('Project creation request:', JSON.stringify(requestBody));
    
    const response = await fetch('https://cloudresourcemanager.googleapis.com/v3/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    // Log the raw response
    const responseText = await response.text();
    console.log('Project creation raw response:', responseText);
    
    if (!response.ok) {
      console.error('Project creation failed:', response.status, response.statusText, responseText);
      throw new Error(`Error creating project: ${response.status} ${response.statusText} - ${responseText}`);
    }
    
    // Parse the response text
    const responseData = responseText ? JSON.parse(responseText) : {};
    console.log('Project created successfully:', responseData);
    
    // Convert v3 response to match GCPProject interface
    return {
      projectId,
      name,
      projectNumber: responseData.name || '',
      createTime: responseData.createTime || new Date().toISOString(),
      lifecycleState: responseData.state || 'ACTIVE'
    };
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
};

// Function to check if a project ID is available
export const checkProjectIdAvailability = async (
  accessToken: string,
  projectId: string
): Promise<boolean> => {
  try {
    const projects = await listProjects(accessToken);
    return !projects.some(project => project.projectId === projectId);
  } catch (error) {
    console.error('Error checking project ID availability:', error);
    throw error;
  }
};

// Function to enable specified APIs for a project
export const enableApisForProject = async (
  accessToken: string,
  projectId: string,
  apiIdentifiers: string[] = ESSENTIAL_APIS
): Promise<void> => {
  try {
    console.log(`Enabling APIs for project ${projectId}:`, apiIdentifiers);
    
    // Process each API in sequence to avoid rate limits and ensure proper ordering
    for (const apiIdentifier of apiIdentifiers) {
      console.log(`Enabling API: ${apiIdentifier}`);
      
      const response = await fetch(`https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${apiIdentifier}:enable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Empty body is fine for the enable endpoint
      });
      
      // Read the response as text first for better error logging
      const responseText = await response.text();
      
      if (!response.ok) {
        console.error(`Failed to enable API ${apiIdentifier}:`, response.status, response.statusText, responseText);
        throw new Error(`Error enabling API ${apiIdentifier}: ${response.status} ${response.statusText} - ${responseText}`);
      }
      
      console.log(`Successfully enabled API: ${apiIdentifier}`);
    }
    
    console.log(`All APIs enabled successfully for project ${projectId}`);
  } catch (error) {
    console.error(`Error enabling APIs for project ${projectId}:`, error);
    throw error;
  }
};

// Function to list enabled services for a project
export const listEnabledServices = async (
  accessToken: string,
  projectId: string
): Promise<string[]> => {
  try {
    console.log(`Fetching enabled services for project ${projectId}`);
    
    const response = await fetch(
      `https://serviceusage.googleapis.com/v1/projects/${projectId}/services?filter=state:ENABLED`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error response when fetching enabled services:`, errorText);
      throw new Error(
        `Error fetching enabled services for project ${projectId}: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    // The response contains a list of service objects, each with a 'name' property
    // like "projects/123456/services/aiplatform.googleapis.com"
    // We want to extract the service identifier (e.g., "aiplatform.googleapis.com")
    const enabledServices = (data.services || []).map((service: any) => {
      const nameParts = service.name.split('/');
      return nameParts[nameParts.length - 1] || '';
    });
    
    console.log(`Enabled services for project ${projectId}:`, enabledServices);
    return enabledServices;
  } catch (error) {
    console.error(`Error listing enabled services for project ${projectId}:`, error);
    throw error;
  }
};

// Function to delete a project
export const deleteProject = async (
  accessToken: string,
  projectId: string
): Promise<void> => {
  try {
    console.log(`Attempting to delete project ${projectId}`);
    
    // Call the Cloud Resource Manager API to delete the project
    const response = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Read the response as text for better error logging
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`Failed to delete project ${projectId}:`, response.status, response.statusText, responseText);
      throw new Error(`Error deleting project: ${response.status} ${response.statusText} - ${responseText}`);
    }
    
    console.log(`Successfully initiated deletion of project ${projectId}`);
    // Note: Project deletion is asynchronous and might take some time to complete on Google's end
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    throw error;
  }
};
