import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  User, 
  UserCredential,
  GoogleAuthProvider,
  getAdditionalUserInfo
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

// Required scopes for full functionality
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/cloud-billing'
];

// Function to check if the current token includes all required scopes
export const checkRequiredScopes = async (token: string): Promise<boolean> => {
  try {
    // Get token info to check scopes
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
    
    if (!response.ok) {
      console.error('Error checking token scopes:', response.status, response.statusText);
      return false;
    }
    
    const tokenInfo = await response.json();
    console.log('Token info:', tokenInfo);
    
    // Check if all required scopes are present
    for (const scope of REQUIRED_SCOPES) {
      if (!tokenInfo.scope || !tokenInfo.scope.includes(scope)) {
        console.warn(`Required scope missing: ${scope}`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking token scopes:', error);
    return false;
  }
};

// Function to force re-authentication to get new scopes
export const forceReauthentication = async (): Promise<void> => {
  try {
    await signOut();
    console.log('User signed out to force re-authentication with new scopes');
    // The user will need to manually sign in again
  } catch (error) {
    console.error('Error during forced re-authentication:', error);
    throw error;
  }
};

// Function to sign in with Google
export const signInWithGoogle = async (): Promise<{ user: User, isNewUser: boolean | undefined, token: string }> => {
  try {
    const result: UserCredential = await signInWithPopup(auth, googleProvider);
    
    // The signed-in user info
    const user = result.user;
    
    // Get access token for GCP API calls
    const credential = GoogleAuthProvider.credentialFromResult(result);
    // This is the OAuth access token that should be used for GCP API calls
    const token = credential?.accessToken || '';
    
    console.log('OAuth credential obtained:', credential ? 'Yes' : 'No');
    console.log('OAuth token length:', token.length);
    
    // Check if this is a new user
    const additionalInfo = getAdditionalUserInfo(result);
    const isNewUser = additionalInfo?.isNewUser;
    
    return { user, isNewUser, token };
  } catch (error: any) {
    // Handle Errors here
    const errorCode = error.code;
    const errorMessage = error.message;
    console.error(`Error signing in: ${errorCode} - ${errorMessage}`);
    throw error;
  }
};

// Function to sign out
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Listen for auth state changes
export const onAuthStateChanged = (callback: (user: User | null) => void): (() => void) => {
  return auth.onAuthStateChanged(callback);
};
