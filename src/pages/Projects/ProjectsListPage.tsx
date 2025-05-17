import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  CircularProgress,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { GCPProject, listProjects } from '../../services/projects';
import { listProjectsForBillingAccount } from '../../services/billing';
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

  // Decode URI component if needed
  const decodedBillingAccountName = billingAccountName ? decodeURIComponent(billingAccountName) : '';

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
      
      console.log(`Fetching projects for billing account: ${decodedBillingAccountName}`);
      try {
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
        setError('Failed to load projects. Please try again later.');
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <CircularProgress />
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
                onClick={() => {/* Navigate to create project */}}
              >
                Create New Project
              </Button>
              
              <Button
                variant="contained"
                color="primary"
                disabled={!selectedProjectId}
                onClick={handleContinue}
              >
                Continue
              </Button>
            </Box>
          </StyledPaper>
        </GridItem>
      </GridContainer>
    </Box>
  );
};

export default ProjectsListPage;
