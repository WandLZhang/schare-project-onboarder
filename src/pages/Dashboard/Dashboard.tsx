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
import { useAuth } from '../../utils/AuthContext';
import { GCPProject, listProjects } from '../../services/projects';
import { forceReauthentication } from '../../services/auth';
import { GridContainer, GridItem, StyledPaper } from '../../components/PageGrids';

const Dashboard: React.FC = () => {
  const { user, accessToken } = useAuth();
  const [projects, setProjects] = useState<GCPProject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!accessToken) {
        console.log('No access token available - skipping project fetch');
        return;
      }
      
      console.log('Fetching projects with accessToken:', accessToken.substring(0, 10) + '...');
      try {
        setLoading(true);
        const projectsList = await listProjects(accessToken);
        setProjects(projectsList);
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
  }, [accessToken]);

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
            <Typography variant="h6" gutterBottom>
              Select a Google Cloud Project
            </Typography>
            
            {projects.length === 0 ? (
              <Typography color="text.secondary">
                No projects found. Create a new GCP project to get started.
              </Typography>
            ) : (
              <List dense>
                {projects
                  .filter(project => project.lifecycleState !== "DELETE_REQUESTED")
                  .map((project) => (
                  <ListItem 
                    key={project.projectId}
                    onClick={() => setSelectedProjectId(project.projectId)}
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
                onClick={() => console.log('Selected project:', selectedProjectId)}
              >
                OK
              </Button>
            </Box>
          </StyledPaper>
        </GridItem>
      </GridContainer>
    </Box>
  );
};

export default Dashboard;
