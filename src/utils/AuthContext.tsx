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
    const unsubscribe = onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (!firebaseUser) {
        // User logged out, clear the token from React state and localStorage
        setAccessToken('');
        localStorage.removeItem(OAUTH_TOKEN_STORAGE_KEY);
      }
      // We no longer try to re-load the token from localStorage here.
      // The token is set via:
      // 1. Initial useState: localStorage.getItem(OAUTH_TOKEN_STORAGE_KEY) || ''
      // 2. Explicitly via setOAuthToken() after a successful signInWithGoogle() or refreshToken()
    });

    return unsubscribe;
  }, []); // Remove accessToken from the dependency array

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
