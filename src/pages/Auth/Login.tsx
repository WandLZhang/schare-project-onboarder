import React from 'react';
import { Box, Button, Container, Typography, Paper } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { signInWithGoogle } from '../../services/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setOAuthToken } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      const { user, token } = await signInWithGoogle();
      
      if (user && token) {
        // Set the OAuth token in context
        setOAuthToken(token);
        // Redirect to dashboard after successful login
        navigate('/dashboard');
      } else if (user) {
        console.error('Login successful but OAuth token missing.');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box 
        sx={{ 
          mt: 8, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center' 
        }}
      >
        <Paper 
          elevation={3} 
          sx={{ 
            p: 4, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            width: '100%'
          }}
        >
          <Typography component="h1" variant="h4" gutterBottom>
            Google Cloud Onboarder
          </Typography>
          
          <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
            Simple tool for getting a Google Cloud project ready for using LLMs in Terra
          </Typography>
          
          <Button 
            variant="contained" 
            startIcon={<GoogleIcon />}
            onClick={handleGoogleSignIn}
            fullWidth
            size="large"
            sx={{ mt: 2 }}
          >
            Sign in with Google
          </Button>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            You'll need to grant permissions to manage GCP resources.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;
