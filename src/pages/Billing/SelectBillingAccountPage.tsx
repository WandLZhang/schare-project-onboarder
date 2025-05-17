import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Button,
  Paper
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { BillingAccount, getBillingAccountsWithCreatePermission } from '../../services/billing';
import { GridContainer, GridItem, StyledPaper } from '../../components/PageGrids';

const SelectBillingAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const [billingAccounts, setBillingAccounts] = useState<BillingAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBillingAccount, setSelectedBillingAccount] = useState<BillingAccount | null>(null);

  useEffect(() => {
    const fetchBillingAccounts = async () => {
      if (!accessToken) {
        console.log('No access token available - skipping billing account fetch');
        return;
      }
      
      console.log('Fetching billing accounts with permission...');
      console.log('Access Token being used by app:', accessToken);
      try {
        setLoading(true);
        const accountsList = await getBillingAccountsWithCreatePermission(accessToken);
        // Filter to only include open billing accounts
        const openAccounts = accountsList.filter(account => account.open);
        setBillingAccounts(openAccounts);
        setError(null);
      } catch (error) {
        console.error('Error fetching billing accounts:', error);
        setError('Failed to load billing accounts. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchBillingAccounts();
  }, [accessToken]);

  const handleAccountSelect = (account: BillingAccount) => {
    setSelectedBillingAccount(account);
  };

  const handleConfirm = () => {
    if (selectedBillingAccount) {
      // Extract the billing account ID from the full name
      // The name format is typically "billingAccounts/XXXXXX-XXXXXX-XXXXXX"
      const billingAccountName = selectedBillingAccount.name;
      navigate(`/billing/${encodeURIComponent(billingAccountName)}/projects`);
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
            <Typography variant="h6" gutterBottom>
              Select a Google Cloud Billing Account
            </Typography>
            
            {billingAccounts.length === 0 ? (
              <Typography color="text.secondary">
                No billing accounts found with the required permissions. You need a billing account where you have the 'billing.resourceAssociations.create' permission.
              </Typography>
            ) : (
              <List>
                {billingAccounts.map((account) => (
                  <ListItem 
                    key={account.name}
                    onClick={() => handleAccountSelect(account)}
                    sx={{ 
                      cursor: 'pointer',
                      bgcolor: selectedBillingAccount?.name === account.name ? 'primary.light' : 'transparent',
                      '&:hover': {
                        bgcolor: selectedBillingAccount?.name === account.name ? 'primary.light' : 'action.hover',
                      }
                    }}
                  >
                    <ListItemText
                      primary={account.displayName}
                      secondary={account.masterBillingAccount ? '(Sub-account)' : ''}
                    />
                  </ListItem>
                ))}
              </List>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                disabled={!selectedBillingAccount}
                onClick={handleConfirm}
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

export default SelectBillingAccountPage;
