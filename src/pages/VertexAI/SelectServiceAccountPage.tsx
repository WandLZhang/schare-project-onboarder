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
  ServiceAccount, 
  listServiceAccountsWithVertexAIRole, 
  createServiceAccount, 
  grantVertexAIUserRoleToServiceAccount 
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
  
  // State for service account creation dialog
  const [openCreateDialog, setOpenCreateDialog] = useState<boolean>(false);
  const [newServiceAccountId, setNewServiceAccountId] = useState<string>('');
  const [newServiceAccountDisplayName, setNewServiceAccountDisplayName] = useState<string>('');
  const [createServiceAccountError, setCreateServiceAccountError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [creationProgress, setCreationProgress] = useState<number>(0);
  const [currentCreationStep, setCurrentCreationStep] = useState<string>('');
  
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
        setError(`Failed to load service accounts: ${error.message || 'Unknown error'}`);
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

  const handleContinue = () => {
    if (selectedServiceAccountEmail && projectId) {
      // Navigate to the next step with the selected service account
      // This will be updated in the future to navigate to the appropriate page
      console.log(`Selected service account ${selectedServiceAccountEmail} for project ${projectId}`);
      // Placeholder for the next step in the flow
      // navigate(`/project/${projectId}/service-account/${encodeURIComponent(selectedServiceAccountEmail)}/next-step`);
    }
  };

  const handleCreateServiceAccount = async () => {
    // Reset error state
    setCreateServiceAccountError(null);
    
    // Validate service account ID - must contain only lowercase letters, numbers, and hyphens
    const accountIdRegex = /^[a-z][a-z0-9-]*[a-z0-9]$/;
    
    if (newServiceAccountId.length < 6 || newServiceAccountId.length > 30) {
      setCreateServiceAccountError('Service Account ID must be between 6 and 30 characters');
      return;
    }
    
    if (!accountIdRegex.test(newServiceAccountId)) {
      if (newServiceAccountId.endsWith('-')) {
        setCreateServiceAccountError('Service Account ID cannot end with a hyphen');
      } else if (!/^[a-z]/.test(newServiceAccountId)) {
        setCreateServiceAccountError('Service Account ID must start with a letter');
      } else {
        setCreateServiceAccountError('Service Account ID can only contain lowercase letters, numbers, and hyphens');
      }
      return;
    }
    
    if (!newServiceAccountDisplayName) {
      setCreateServiceAccountError('Display name is required');
      return;
    }
    
    // Start the creation process
    try {
      if (!accessToken || !projectId) {
        setCreateServiceAccountError('Missing access token or project ID');
        return;
      }
      
      setIsCreating(true);
      setCreationProgress(0);
      setCurrentCreationStep('Creating service account...');
      
      // Create the service account
      const serviceAccount = await createServiceAccount(
        accessToken,
        projectId,
        newServiceAccountId,
        newServiceAccountDisplayName
      );
      
      setCreationProgress(50);
      setCurrentCreationStep('Granting Vertex AI User role...');
      
      // Grant the Vertex AI User role to the service account
      await grantVertexAIUserRoleToServiceAccount(
        accessToken,
        projectId,
        serviceAccount.email
      );
      
      setCreationProgress(100);
      setCurrentCreationStep('Service account created successfully!');
      
      // Add the new service account to the list and select it
      setServiceAccounts(prevAccounts => [...prevAccounts, serviceAccount]);
      setSelectedServiceAccountEmail(serviceAccount.email);
      
      // Close the dialog and reset form
      setTimeout(() => {
        setOpenCreateDialog(false);
        setNewServiceAccountId('');
        setNewServiceAccountDisplayName('');
        setCreationProgress(0);
        setCurrentCreationStep('');
        setIsCreating(false);
      }, 1000); // Brief delay to show the success message
      
    } catch (error: any) {
      console.error('Error creating service account:', error);
      setCreateServiceAccountError(`Failed to create service account: ${error.message || 'Unknown error'}`);
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => setOpenCreateDialog(true)}
              >
                Create New Service Account
              </Button>
              
              <Button
                variant="contained"
                color="primary"
                disabled={!selectedServiceAccountEmail}
                onClick={handleContinue}
              >
                Continue
              </Button>
            </Box>

            {/* Create Service Account Dialog */}
            <Dialog 
              open={openCreateDialog} 
              onClose={() => !isCreating && setOpenCreateDialog(false)}
              fullWidth
              maxWidth="sm"
            >
              <DialogTitle>
                Create New Service Account
              </DialogTitle>
              <DialogContent>
                <Box sx={{ my: 2 }}>
                  <TextField
                    fullWidth
                    label="Service Account ID"
                    value={newServiceAccountId}
                    onChange={(e) => setNewServiceAccountId(e.target.value.toLowerCase())}
                    margin="normal"
                    helperText="ID must be 6-30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens"
                    error={Boolean(createServiceAccountError)}
                    disabled={isCreating}
                    autoFocus
                  />
                  <TextField
                    fullWidth
                    label="Display Name"
                    value={newServiceAccountDisplayName}
                    onChange={(e) => setNewServiceAccountDisplayName(e.target.value)}
                    margin="normal"
                    helperText="A human-readable name for this service account"
                    error={Boolean(createServiceAccountError)}
                    disabled={isCreating}
                  />
                  {createServiceAccountError && (
                    <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                      {createServiceAccountError}
                    </Typography>
                  )}
                  
                  {isCreating && (
                    <Box sx={{ width: '100%', mt: 3 }}>
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
                </Box>
              </DialogContent>
              <DialogActions>
                <Button 
                  onClick={() => {
                    setOpenCreateDialog(false);
                    setNewServiceAccountId('');
                    setNewServiceAccountDisplayName('');
                    setCreateServiceAccountError(null);
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateServiceAccount} 
                  variant="contained" 
                  color="primary"
                  disabled={isCreating || !newServiceAccountId || !newServiceAccountDisplayName}
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </Button>
              </DialogActions>
            </Dialog>
          </StyledPaper>
        </GridItem>
      </GridContainer>
    </Box>
  );
};

export default SelectServiceAccountPage;
