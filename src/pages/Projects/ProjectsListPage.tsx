import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { 
  GCPProject, 
  listProjects, 
  createProject, 
  checkProjectIdAvailability,
  enableApisForProject,
  deleteProject,
  ESSENTIAL_APIS
} from '../../services/projects';
import { 
  listProjectsForBillingAccount, 
  linkBillingAccount, 
  testBillingAccountPermissions,
  getAdministratorEmail,
  checkIfUserIsBillingAdmin,
  getTokenInfo,
  getBillingAccountIamPolicy
} from '../../services/billing';
import { checkRequiredScopes, forceReauthentication } from '../../services/auth';
import { GridContainer, GridItem, StyledPaper } from '../../components/PageGrids';

// Interface for project billing info
interface ProjectBillingInfo {
  name: string;
  projectId: string;
  billingAccountName: string;
  billingEnabled: boolean;
}

const ProjectsListPage: React.FC = () => {
  const { billingAccountName } = useParams<{ billingAccountName: string }>();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const [projects, setProjects] = useState<GCPProject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // State for project creation dialog
  const [openCreateProjectDialog, setOpenCreateProjectDialog] = useState<boolean>(false);
  const [newProjectId, setNewProjectId] = useState<string>('');
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState<boolean>(false);
  const [hasVerifiedPermissions, setHasVerifiedPermissions] = useState<boolean>(false);
  const [hasLinkPermission, setHasLinkPermission] = useState<boolean | null>(null);
  const [checkingPermissions, setCheckingPermissions] = useState<boolean>(false);
  
  // State for project creation progress
  const [creationProgress, setCreationProgress] = useState<number>(0);
  const [currentCreationStep, setCurrentCreationStep] = useState<string>('');
  
  // State for project polling - check if newly created project appears in the list
  const [isPollingForProject, setIsPollingForProject] = useState<boolean>(false);
  const [pollingProjectId, setPollingProjectId] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<{
    isAdmin: boolean;
    userEmail: string | null;
    checking: boolean;
    billingAdmins: string[];
    loadingAdmins: boolean;
    showAdmins: boolean;
    iamPolicyError: string | null;
  }>({
    isAdmin: false,
    userEmail: null,
    checking: false,
    billingAdmins: [],
    loadingAdmins: false,
    showAdmins: false,
    iamPolicyError: null
  });

  // Decode URI component if needed
  const decodedBillingAccountName = billingAccountName ? decodeURIComponent(billingAccountName) : '';

  // Function to fetch all billing administrators
  const fetchBillingAdministrators = async () => {
    if (!accessToken || !decodedBillingAccountName) {
      console.error('No access token or billing account name available');
      return;
    }
    
    setAdminStatus(prev => ({ ...prev, loadingAdmins: true, iamPolicyError: null }));
    
    try {
      console.log(`Fetching IAM policy for ${decodedBillingAccountName} via Cloud Function...`);
      const iamPolicyData = await getBillingAccountIamPolicy(accessToken, decodedBillingAccountName);
      
      setAdminStatus(prev => ({ 
        ...prev, 
        billingAdmins: iamPolicyData.billingAdminMembers || [],
        loadingAdmins: false,
        showAdmins: true
      }));
      
      console.log('Successfully fetched billing admins:', iamPolicyData.billingAdminMembers);
      
      // Get user information
      const tokenInfo = await getTokenInfo(accessToken);
      if (tokenInfo?.email) {
        console.log(`Current user email: ${tokenInfo.email}`);
      }
      
    } catch (error) {
      console.error('Error fetching billing administrators:', error);
      setAdminStatus(prev => ({ 
        ...prev, 
        loadingAdmins: false,
        iamPolicyError: 'Failed to fetch billing administrators. The Cloud Function may not be deployed yet.'
      }));
    }
  };

  // Check for administrator status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (accessToken && decodedBillingAccountName) {
        setAdminStatus(prev => ({ ...prev, checking: true }));
        try {
          // Get user email - this function already checks admin status internally
          const adminEmail = await getAdministratorEmail(accessToken, decodedBillingAccountName);
          
          // If adminEmail is returned, user is an admin
          const isAdmin = adminEmail !== null;
          
          setAdminStatus(prev => ({
            ...prev,
            isAdmin,
            userEmail: adminEmail,
            checking: false
          }));
          
        } catch (error) {
          console.error('Error checking admin status:', error);
          setAdminStatus(prev => ({
            ...prev,
            isAdmin: false,
            userEmail: null,
            checking: false
          }));
        }
      }
    };
    
    checkAdminStatus();
  }, [accessToken, decodedBillingAccountName]);

  // For future debugging if needed
  useEffect(() => {
    // Placeholder for future debugging needs
  }, [accessToken]);
  
  // Check if the user has required permissions for this billing account
  useEffect(() => {
    const verifyBillingPermissions = async () => {
      if (accessToken && decodedBillingAccountName) {
        setCheckingPermissions(true);
        try {
          // Check if the user can create associations with this billing account
          const permissions = await testBillingAccountPermissions(
            accessToken,
            decodedBillingAccountName,
            ['billing.resourceAssociations.create']
          );
          
          const hasPermission = permissions.includes('billing.resourceAssociations.create');
          setHasLinkPermission(hasPermission);
          
          setHasVerifiedPermissions(true);
        } catch (error) {
          console.error('Error checking billing permissions:', error);
          setHasLinkPermission(false);
          setHasVerifiedPermissions(true);
        } finally {
          setCheckingPermissions(false);
        }
      }
    };
    
    verifyBillingPermissions();
  }, [accessToken, decodedBillingAccountName]);

  // Force re-authentication when permissions are missing
  useEffect(() => {
    const handleMissingPermissions = async () => {
      // If we've verified permissions and user lacks linking permission, force re-authentication
      if (hasVerifiedPermissions && hasLinkPermission === false) {
        console.log('User lacks billing account permissions. Forcing re-authentication...');
        await forceReauthentication();
      }
    };
    
    handleMissingPermissions();
  }, [hasVerifiedPermissions, hasLinkPermission]);

  // Track if we've already fetched projects for this billing account
  const [hasFetchedProjects, setHasFetchedProjects] = useState<string | null>(null);
  
  // Poll for newly created project
  useEffect(() => {
    if (isPollingForProject && pollingProjectId && accessToken && decodedBillingAccountName) {
      console.log(`Starting to poll for project ${pollingProjectId} to appear in the list...`);
      
      // Set up interval to check every 3 seconds
      const intervalId = setInterval(async () => {
        try {
          console.log(`Checking if project ${pollingProjectId} has appeared in the list...`);
          
          // First get project billing info from the billing account
          const projectBillingInfoList = await listProjectsForBillingAccount(
            accessToken, 
            decodedBillingAccountName
          );
          
          // Extract project IDs
          const projectIds = projectBillingInfoList
            .filter((info: ProjectBillingInfo) => info.billingEnabled)
            .map((info: ProjectBillingInfo) => {
              const parts = info.name.split('/');
              return parts.length > 1 ? parts[1] : '';
            })
            .filter(id => id);
          
          // Then get full project details
          const allProjects = await listProjects(accessToken);
          const filteredProjects = allProjects.filter(project => 
            projectIds.includes(project.projectId)
          );
          
          // Check if our project is in the list
          const projectFound = filteredProjects.some(project => project.projectId === pollingProjectId);
          
          if (projectFound) {
            console.log(`Project ${pollingProjectId} found in the list!`);
            // Update projects state
            setProjects(filteredProjects);
            // Stop polling
            setIsPollingForProject(false);
            setPollingProjectId(null);
            setLoading(false);
            clearInterval(intervalId);
          } else {
            console.log(`Project ${pollingProjectId} not found yet, continuing to poll...`);
          }
        } catch (error) {
          console.error('Error while polling for project:', error);
          // Stop polling on error
          setIsPollingForProject(false);
          setPollingProjectId(null);
          setLoading(false);
          clearInterval(intervalId);
        }
      }, 3000); // Check every 3 seconds
      
      // Clean up the interval when the component unmounts or dependencies change
      return () => {
        console.log('Cleaning up polling interval');
        clearInterval(intervalId);
      };
    }
  }, [isPollingForProject, pollingProjectId, accessToken, decodedBillingAccountName]);
  
  useEffect(() => {
    const fetchProjects = async () => {
      if (!accessToken) {
        console.log('No access token available - skipping project fetch');
        return;
      }

      if (!decodedBillingAccountName) {
        setError('No billing account selected. Please go back and select a billing account.');
        setLoading(false);
        return;
      }
      
      // Skip if we're already fetched projects for this billing account
      if (hasFetchedProjects === decodedBillingAccountName) {
        return;
      }
      
      try {
        setHasFetchedProjects(decodedBillingAccountName);
        setLoading(true);
        
        // First get project billing info from the billing account
        const projectBillingInfoList = await listProjectsForBillingAccount(
          accessToken, 
          decodedBillingAccountName
        );
        
        if (projectBillingInfoList.length === 0) {
          // No projects associated with this billing account
          setProjects([]);
          setLoading(false);
          return;
        }
        
        // Extract project IDs
        const projectIds = projectBillingInfoList
          .filter((info: ProjectBillingInfo) => info.billingEnabled)
          .map((info: ProjectBillingInfo) => {
            // The name format is typically projects/PROJECT_ID
            const parts = info.name.split('/');
            return parts.length > 1 ? parts[1] : '';
          })
          .filter(id => id);
        
        if (projectIds.length === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }
        
        // Then get full project details - we need to use the regular listProjects function
        // and filter by the project IDs we found
        const allProjects = await listProjects(accessToken);
        const filteredProjects = allProjects.filter(project => 
          projectIds.includes(project.projectId)
        );
        
        setProjects(filteredProjects);
        setError(null);
      } catch (error) {
        console.error('Error fetching projects:', error);
        // Instead of showing error message, force re-authentication
        await forceReauthentication();
        return; // Exit the function after forcing re-authentication
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [accessToken, decodedBillingAccountName]);

  const handleBackClick = () => {
    navigate('/dashboard');
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  const handleContinue = () => {
    if (selectedProjectId) {
      // Navigate to the next step with the selected project
      console.log('Selected project:', selectedProjectId);
      // This would navigate to the actual next page when implemented
      // For now, just logging the selection
    }
  };

  const handleOpenIamHelp = () => {
    // Open GCP console IAM page for the billing account
    window.open(`https://console.cloud.google.com/billing/${decodedBillingAccountName.replace('billingAccounts/', '')}?tab=permissions`, '_blank');
  };

  // Helper function to clean up project if any step fails after creation
  const cleanupFailedProject = async (
    accessToken: string, 
    projectId: string | null, 
    failureStep: string
  ): Promise<void> => {
    if (!projectId) return;
    
    console.log(`Attempting to clean up project ${projectId} due to ${failureStep}...`);
    try {
      await deleteProject(accessToken, projectId);
      console.log(`Project ${projectId} successfully deleted.`);
      setCreateProjectError(prev => 
        `${prev ? prev + ' ' : ''}Project ${projectId} was deleted due to ${failureStep}.`
      );
    } catch (deleteError: any) {
      console.error(`Failed to automatically delete project ${projectId}:`, deleteError);
      setCreateProjectError(prev => 
        `${prev ? prev + ' ' : ''}Failed to delete project ${projectId} after ${failureStep}: ${deleteError.message || 'unknown error'}. Please delete it manually.`
      );
    }
  };

  const handleCreateProject = async () => {
    // Reset error state
    setCreateProjectError(null);
    
    // Variable to track the created project's ID for cleanup if needed
    let createdProjectId: string | null = null;
    
    // Validate project ID format - must start with a letter, end with a letter or number, contain only lowercase letters, numbers, and hyphens
    const projectIdRegex = /^[a-z][a-z0-9-]*[a-z0-9]$/;
    
    // Check length requirement (6-30 characters)
    if (newProjectId.length < 6 || newProjectId.length > 30) {
      setCreateProjectError('Project ID must be between 6 and 30 characters');
      return;
    }
    
    // Check character requirement and pattern
    if (!projectIdRegex.test(newProjectId)) {
      if (newProjectId.endsWith('-')) {
        setCreateProjectError('Project ID cannot end with a hyphen');
      } else if (!/^[a-z]/.test(newProjectId)) {
        setCreateProjectError('Project ID must start with a letter');
      } else {
        setCreateProjectError('Project ID can only contain lowercase letters, numbers, and hyphens');
      }
      return;
    }
    
    // Check for restricted strings
    const restrictedStrings = ['google', 'ssl', 'undefined', 'null'];
    for (const restricted of restrictedStrings) {
      if (newProjectId.includes(restricted)) {
        setCreateProjectError(`Project ID cannot contain the restricted string "${restricted}"`);
        return;
      }
    }
    
    // If validation passes, proceed with project creation
    try {
      setIsCreatingProject(true);
      setCreationProgress(0);
      setCurrentCreationStep('Initializing project creation...');
      
      console.log(`Starting project creation workflow for ID: ${newProjectId}`);
      
      // Check if project ID is available (not in use or previously used)
      setCurrentCreationStep('Checking if project ID is available...');
      console.log(`Checking if project ID ${newProjectId} is available...`);
      const isAvailable = await checkProjectIdAvailability(accessToken || '', newProjectId);
      if (!isAvailable) {
        setCreateProjectError('Project ID is already in use or was previously used');
        setIsCreatingProject(false);
        setCreationProgress(0);
        setCurrentCreationStep('');
        return;
      }
      setCreationProgress(15);
      console.log(`Project ID ${newProjectId} is available, proceeding with creation`);
      
      // 1. Create the project
      setCurrentCreationStep(`Creating project ${newProjectId}...`);
      console.log(`Creating project ${newProjectId}...`);
      let createdProject;
      try {
        createdProject = await createProject(
          accessToken || '', 
          newProjectId,
          newProjectId // Using project ID as name for simplicity
        );
        createdProjectId = newProjectId; // Store the ID in case we need to clean up
        console.log(`Project created successfully:`, createdProject);
        setCreationProgress(30);
        
        // Add a delay to allow IAM permissions to propagate
        // This helps avoid "Project not found or permission denied" errors
        setCurrentCreationStep(`Waiting for IAM permissions to propagate...`);
        console.log(`Waiting 10 seconds for IAM permissions to propagate for project ${newProjectId}...`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10-second delay
        setCreationProgress(45);
        console.log(`Delay completed, proceeding with API enablement for ${newProjectId}`);
        
      } catch (projectCreationError: any) {
        console.error('Project creation failed:', projectCreationError);
        // Extract the most useful error message
        let errorMessage = 'Failed to create project.';
        if (projectCreationError.message) {
          errorMessage += ` Error: ${projectCreationError.message}`;
        }
        setCreateProjectError(errorMessage);
        setIsCreatingProject(false);
        return; // Stop here and don't attempt subsequent steps
      }
      
      // 2. Enable APIs for the project (including Vertex AI)
      setCurrentCreationStep(`Enabling essential APIs for project ${newProjectId}...`);
      console.log(`Enabling essential APIs for project ${newProjectId}...`);
      try {
        await enableApisForProject(accessToken || '', newProjectId, ESSENTIAL_APIS);
        setCreationProgress(60);
        console.log(`Successfully enabled APIs for project ${newProjectId}`);
      } catch (apiError: any) {
        console.error('API enablement failed:', apiError);
        let errorMessage = 'Project was created but APIs could not be enabled.';
        if (apiError.message) {
          errorMessage += ` Error: ${apiError.message}`;
        }
        setCreateProjectError(errorMessage);
        
        // Clean up the project since API enablement failed
        await cleanupFailedProject(accessToken || '', createdProjectId, 'API enablement failure');
        setIsCreatingProject(false);
        return;
      }
      
      // We've already verified billing permissions when the page loaded
      // Check hasLinkPermission to ensure the user still has permission
      if (hasLinkPermission !== true) {
        console.error('Billing link permission is not granted. Aborting project linking.');
        setCreateProjectError('Billing permission not granted. Please ensure your account has the necessary permissions.');
        // Clean up the project
        await cleanupFailedProject(accessToken || '', createdProjectId, 'billing permission check failure');
        setIsCreatingProject(false);
        return;
      }
      setCreationProgress(75);
      console.log('User has the required billing permissions (verified on page load)');
      
      // 4. Link the project to billing account
      setCurrentCreationStep(`Linking project to billing account...`);
      console.log(`Linking project ${newProjectId} to billing account ${decodedBillingAccountName}...`);
      try {
        await linkBillingAccount(
          accessToken || '',
          newProjectId,
          decodedBillingAccountName
        );
        setCreationProgress(100);
        setCurrentCreationStep(`Project setup complete!`);
        console.log(`Successfully linked project ${newProjectId} to billing account ${decodedBillingAccountName}`);
      } catch (billingError: any) {
        console.error('Billing account link failed:', billingError);
        
        // Note: The linkBillingAccountDirect function (called by linkBillingAccount) 
        // already attempts to delete the project on failure. But we'll check the error message
        // and provide a specific message about it.
        
        let errorMessage = 'Failed to link billing account.';
        if (billingError.message) {
          errorMessage = billingError.message; // Use the full message which includes deletion status
        }
        
        setCreateProjectError(errorMessage);
        setIsCreatingProject(false);
        return;
      }
      
      // Successfully completed all steps
      console.log('Project created, APIs enabled, and billing account linked successfully:', createdProject);
      
      // Close dialog and reset form
      setOpenCreateProjectDialog(false);
      setNewProjectId('');
      
      // Start polling for the project to appear in the project list
      console.log('Refreshing project list...');
      if (accessToken && decodedBillingAccountName) {
        setLoading(true);
        setPollingProjectId(newProjectId);
        setIsPollingForProject(true);
        console.log('Project list refreshed successfully');
      }
      
    } catch (error: any) {
      console.error('Unexpected error in project creation workflow:', error);
      let errorMessage = 'An unexpected error occurred.';
      if (error.message) {
        errorMessage += ` ${error.message}`;
      }
      setCreateProjectError(errorMessage);
    } finally {
      setIsCreatingProject(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <CircularProgress />
        {isPollingForProject && pollingProjectId && (
          <Typography sx={{ mt: 2 }}>
            Waiting for project "{pollingProjectId}" to appear in the list... This may take a moment.
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'error.light', color: 'error.contrastText' }}>
          <Typography>{error}</Typography>
        </Paper>
      )}

      <GridContainer>
        <GridItem xs={12}>
          <StyledPaper>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Button 
                variant="contained"
                color="primary"
                onClick={handleBackClick}
                sx={{ mr: 2 }}
              >
                <ArrowBackIcon />
              </Button>
              <Typography variant="h6">
                Select a Google Cloud Project
              </Typography>
            </Box>
            
            {projects.length === 0 ? (
              <Typography color="text.secondary">
                No projects found for this billing account. Create a new GCP project to get started.
              </Typography>
            ) : (
              <List dense>
                {projects
                  .filter(project => project.lifecycleState !== "DELETE_REQUESTED")
                  .map((project) => (
                  <ListItem 
                    key={project.projectId}
                    onClick={() => handleProjectSelect(project.projectId)}
                    sx={{ 
                      cursor: 'pointer',
                      bgcolor: selectedProjectId === project.projectId ? 'primary.light' : 'transparent',
                      '&:hover': {
                        bgcolor: selectedProjectId === project.projectId ? 'primary.light' : 'action.hover',
                      }
                    }}
                  >
                    <ListItemText
                      primary={project.name}
                      secondary={`ID: ${project.projectId}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => setOpenCreateProjectDialog(true)}
                disabled={hasLinkPermission === false}
              >
                Create New Project
              </Button>
              
              {/* The warning about permissions has been replaced with automatic re-login */}
              
              <Button
                variant="contained"
                color="primary"
                disabled={!selectedProjectId}
                onClick={handleContinue}
              >
                Continue
              </Button>
            </Box>

            {/* Create Project Dialog */}
            <Dialog 
              open={openCreateProjectDialog} 
              onClose={() => setOpenCreateProjectDialog(false)}
              fullWidth
              maxWidth="sm"
            >
              <DialogTitle>
                Create New Google Cloud Project
                {/* Warning message removed - we now force re-login instead */}
              </DialogTitle>
              <DialogContent>
                <Box sx={{ my: 2 }}>
                  <TextField
                    fullWidth
                    label="Project ID"
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value.toLowerCase())}
                    margin="normal"
                    helperText="Project ID must be 6-30 characters, start with a letter, not end with a hyphen, and contain only lowercase letters, numbers, and hyphens"
                    error={Boolean(createProjectError)}
                    disabled={isCreatingProject}
                    autoFocus
                  />
                  {createProjectError && (
                    <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                      {createProjectError}
                    </Typography>
                  )}
                  
                  {isCreatingProject && (
                    <Box sx={{ width: '100%', mt: 3 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {currentCreationStep || 'Creating project...'}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={creationProgress} 
                        sx={{ height: 10, borderRadius: 5 }}
                      />
                    </Box>
                  )}
                </Box>
              </DialogContent>
              <DialogActions>
                <Button 
                  onClick={() => {
                    setOpenCreateProjectDialog(false);
                    setNewProjectId('');
                    setCreateProjectError(null);
                  }}
                  disabled={isCreatingProject}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateProject} 
                  variant="contained" 
                  color="primary"
                  disabled={isCreatingProject || !newProjectId}
                >
                  {isCreatingProject ? 'Creating...' : 'Create'}
                </Button>
              </DialogActions>
            </Dialog>
          </StyledPaper>
        </GridItem>
      </GridContainer>
    </Box>
  );
};

export default ProjectsListPage;
