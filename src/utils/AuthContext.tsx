import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithGoogle } from '../services/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accessToken: string;
  setOAuthToken: (token: string) => void;
  refreshToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  accessToken: '',
  setOAuthToken: () => {},
  refreshToken: async () => ''
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

// localStorage key for the OAuth token
const OAUTH_TOKEN_STORAGE_KEY = 'gcp_oauth_token';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string>(() => {
    // Initialize from localStorage if available
    return localStorage.getItem(OAUTH_TOKEN_STORAGE_KEY) || '';
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
      if (!user) {
        // Clear token on logout
        setAccessToken('');
        localStorage.removeItem(OAUTH_TOKEN_STORAGE_KEY);
      } else if (!accessToken) {
        // If user exists but no accessToken in state, try to get from localStorage
        const storedToken = localStorage.getItem(OAUTH_TOKEN_STORAGE_KEY);
        if (storedToken) {
          setAccessToken(storedToken);
        }
      }
    });

    return unsubscribe;
  }, [accessToken]);

  const setOAuthToken = (token: string) => {
    // Set token in state
    setAccessToken(token);
    // Also persist to localStorage
    if (token) {
      localStorage.setItem(OAUTH_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(OAUTH_TOKEN_STORAGE_KEY);
    }
  };

  const refreshToken = async (): Promise<string> => {
    console.log('Attempting to refresh OAuth token...');
    try {
      if (!user) {
        console.error('Cannot refresh token: User not logged in');
        return '';
      }
      
      // Re-authenticate to get a fresh token
      const { token: newToken } = await signInWithGoogle();
      
      if (newToken) {
        console.log('Successfully refreshed OAuth token');
        setOAuthToken(newToken);
        return newToken;
      } else {
        console.error('Failed to get new token during refresh');
        return '';
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      return '';
    }
  };

  const value = {
    user,
    loading,
    accessToken,
    setOAuthToken,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
