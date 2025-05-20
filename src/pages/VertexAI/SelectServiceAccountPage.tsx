import React, { useEffect, useState, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Snackbar
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { forceReauthentication } from '../../services/auth';
import { 
  ServiceAccount, 
  listServiceAccountsWithVertexAIRole, 
  createServiceAccount, 
  grantVertexAIUserRoleToServiceAccount,
  grantUserRoleOnServiceAccount
} from '../../services/iam';
import { GridContainer, GridItem, StyledPaper } from '../../components/PageGrids';

const SelectServiceAccountPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  
  // State for service accounts
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServiceAccountEmail, setSelectedServiceAccountEmail] = useState<string | null>(null);
  
  // State for service account creation
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [creationProgress, setCreationProgress] = useState<number>(0);
  const [currentCreationStep, setCurrentCreationStep] = useState<string>('');
  
  // State for copy notification
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  
  // Ref to track if a service account fetch is in progress
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchedTokenRef = useRef<string | null>(null);

  // Fetch service accounts when the component mounts or the token changes
  useEffect(() => {
    const fetchServiceAccounts = async () => {
      if (!accessToken || !projectId) {
        console.log('No access token or project ID available - skipping service account fetch');
        if (!projectId) {
          setError('No project ID specified. Please go back and select a project.');
          setLoading(false);
        }
        return;
      }
      
      // Prevent fetch if already loading or if the token hasn't changed and we already have data
      if (isFetchingRef.current) {
        console.log('Fetch already in progress, skipping duplicate fetch request');
        return;
      }
      
      if (serviceAccounts.length > 0 && accessToken === lastFetchedTokenRef.current) {
        console.log('Service accounts already loaded with this token. Skipping fetch.');
        setLoading(false);
        return;
      }
      
      // Set our fetching ref to true to prevent concurrent fetches
      isFetchingRef.current = true;
      
      try {
        setLoading(true);
        console.log(`Fetching service accounts with Vertex AI User role for project ${projectId}...`);
        const accounts = await listServiceAccountsWithVertexAIRole(accessToken, projectId);
        setServiceAccounts(accounts);
        lastFetchedTokenRef.current = accessToken;
        setError(null);
        console.log(`Retrieved ${accounts.length} service accounts with Vertex AI User role`);
      } catch (error: any) {
        console.error('Error fetching service accounts:', error);
        // Instead of showing error message, force re-authentication
        await forceReauthentication();
        return; // Exit the function after forcing re-authentication
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    fetchServiceAccounts();
  }, [accessToken, projectId, serviceAccounts.length]);

  const handleBackClick = () => {
    navigate('/dashboard');
  };

  const handleServiceAccountSelect = (email: string) => {
    setSelectedServiceAccountEmail(email);
  };

  const handleCopyProjectId = () => {
    if (projectId) {
      // Copy project ID to clipboard
      navigator.clipboard.writeText(projectId);
      // Show notification with project ID
      setSnackbarMessage(`Project ID "${projectId}" copied!`);
      console.log(`Copied project ID: ${projectId} to clipboard`);
    }
  };
  
  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbarMessage('');
  };

  // Generate a unique service account ID and display name
  const generateServiceAccountDetails = () => {
    // Generate a timestamp-based random suffix
    const timestamp = Date.now().toString().slice(-6);
    const randomChars = Math.random().toString(36).substring(2, 5);
    
    // Combine to create a unique ID (schare-vertex-[timestamp]-[random])
    const accountId = `schare-vertex-${timestamp}-${randomChars}`;
    
    // Create a user-friendly display name
    let displayName = 'Schare Auto Vertex SA';
    if (user?.email) {
      // Add username part of the email (before @) if available
      const username = user.email.split('@')[0];
      if (username) {
        displayName += ` (${username})`;
      }
    }
    
    return {
      accountId: accountId.substring(0, 30), // Ensure it's not over 30 chars
      displayName
    };
  };

  // Automatically create a service account with Vertex AI User role and add user as principal
  const handleAutoCreateServiceAccount = async () => {
    // Reset any error state
    setError(null);
    
    try {
      if (!accessToken || !projectId) {
        setError('Missing access token or project ID');
        return;
      }
      
      if (!user?.email) {
        setError('User email is required to grant permissions');
        return;
      }
      
      // Show loading UI
      setIsCreating(true);
      setCreationProgress(0);
      setCurrentCreationStep('Generating service account details...');
      
      // Generate service account details
      const { accountId, displayName } = generateServiceAccountDetails();
      
      setCreationProgress(10);
      setCurrentCreationStep('Creating service account...');
      
      // Create the service account
      const serviceAccount = await createServiceAccount(
        accessToken,
        projectId,
        accountId,
        displayName
      );
      
      setCreationProgress(40);
      setCurrentCreationStep('Granting Vertex AI User role to service account...');
      
      // Grant the Vertex AI User role to the service account
      await grantVertexAIUserRoleToServiceAccount(
        accessToken,
        projectId,
        serviceAccount.email
      );
      
      setCreationProgress(70);
      setCurrentCreationStep('Adding you as a service account user...');
      
      // Grant the current user permission to use this service account
      await grantUserRoleOnServiceAccount(
        accessToken,
        projectId,
        serviceAccount.email,
        user.email,
        'roles/iam.serviceAccountUser'
      );
      
      setCreationProgress(100);
      setCurrentCreationStep('Service account created and configured successfully!');
      
      // Add the new service account to the list and select it
      setServiceAccounts(prevAccounts => [...prevAccounts, serviceAccount]);
      setSelectedServiceAccountEmail(serviceAccount.email);
      
      // Reset progress state after a brief delay to show success message
      setTimeout(() => {
        setCreationProgress(0);
        setCurrentCreationStep('');
        setIsCreating(false);
      }, 1500);
      
    } catch (error: any) {
      console.error('Error creating service account:', error);
      setError(`Failed to create service account: ${error.message || 'Unknown error'}`);
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>
          Loading service accounts...
        </Typography>
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
                Select a Service Account with Vertex AI User Role
              </Typography>
            </Box>
            
            {serviceAccounts.length === 0 ? (
              <Typography color="text.secondary">
                No service accounts found with Vertex AI User role. Create a new service account to get started.
              </Typography>
            ) : (
              <List dense>
                {serviceAccounts.map((account) => (
                  <ListItem 
                    key={account.email}
                    onClick={() => handleServiceAccountSelect(account.email)}
                    sx={{ 
                      cursor: 'pointer',
                      bgcolor: selectedServiceAccountEmail === account.email ? 'primary.light' : 'transparent',
                      '&:hover': {
                        bgcolor: selectedServiceAccountEmail === account.email ? 'primary.light' : 'action.hover',
                      }
                    }}
                  >
                    <ListItemText
                      primary={account.displayName || account.email}
                      secondary={`Email: ${account.email}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
            
            {/* Progress indicator for automatic service account creation */}
            {isCreating && (
              <Box sx={{ mt: 2, mb: 3, width: '100%' }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {currentCreationStep || 'Creating service account...'}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={creationProgress} 
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Button 
                variant="contained" 
                color="primary"
                onClick={handleAutoCreateServiceAccount}
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create New Service Account'}
              </Button>
              
              <Button
                variant="contained"
                color="primary"
                disabled={!projectId || isCreating}
                onClick={handleCopyProjectId}
              >
                Copy Project ID
              </Button>
            </Box>
          </StyledPaper>
        </GridItem>
      </GridContainer>
      {/* Snackbar for copy notification */}
      <Snackbar
        open={snackbarMessage !== ''}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: 'black',
            color: 'white'
          }
        }}
      />
    </Box>
  );
};

export default SelectServiceAccountPage;
