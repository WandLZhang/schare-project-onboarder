import { getCurrentUser } from './auth';

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
    const response = await fetch('https://cloudresourcemanager.googleapis.com/v1/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectId,
        name
      })
    });

    if (!response.ok) {
      throw new Error(`Error creating project: ${response.status} ${response.statusText}`);
    }

    return await response.json();
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
