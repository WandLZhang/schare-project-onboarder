import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { AuthProvider } from './utils/AuthContext';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import SelectBillingAccountPage from './pages/Billing/SelectBillingAccountPage';
import ProjectsListPage from './pages/Projects/ProjectsListPage';
import Layout from './components/Layout';
import { useAuth } from './utils/AuthContext';

// Create a custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1a73e8',
    },
    secondary: {
      main: '#ff5722',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/billing/select" />} />
            
            {/* Redirect dashboard to billing selection */}
            <Route path="/dashboard" element={<Navigate to="/billing/select" />} />
            
            {/* Billing account selection - new entry point */}
            <Route path="/billing/select" element={
              <ProtectedRoute>
                <Layout>
                  <SelectBillingAccountPage />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* Projects list for a specific billing account */}
            <Route path="/billing/:billingAccountName/projects" element={
              <ProtectedRoute>
                <Layout>
                  <ProjectsListPage />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* Keep original dashboard for backward compatibility or future use */}
            <Route path="/dashboard/original" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />

            {/* Add placeholder routes for the other sections */}
            <Route path="/projects" element={
              <ProtectedRoute>
                <Layout>
                  <div>Projects Page (Coming Soon)</div>
                </Layout>
              </ProtectedRoute>
            } />

            {/* General billing route - could be a dashboard of billing accounts */}
            <Route path="/billing" element={
              <ProtectedRoute>
                <Layout>
                  <Navigate to="/billing/select" />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/vertex-ai" element={
              <ProtectedRoute>
                <Layout>
                  <div>Vertex AI Page (Coming Soon)</div>
                </Layout>
              </ProtectedRoute>
            } />

            {/* Catch all unknown routes */}
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
