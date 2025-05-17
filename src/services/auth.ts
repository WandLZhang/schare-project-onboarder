import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  User, 
  UserCredential,
  GoogleAuthProvider,
  getAdditionalUserInfo
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

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
