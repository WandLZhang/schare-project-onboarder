import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCwI08TncslS8hcgOy3TWQxgycHTSlfiac",
  authDomain: "gemini-med-lit-review.firebaseapp.com",
  projectId: "gemini-med-lit-review",
  storageBucket: "gemini-med-lit-review.firebasestorage.app",
  messagingSenderId: "934163632848",
  appId: "1:934163632848:web:a228fe2bcd1d17bf2e44d5",
  measurementId: "G-N0JV22VX6S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Add GCP API scopes needed for the application
googleProvider.addScope('https://www.googleapis.com/auth/cloud-platform');
googleProvider.addScope('https://www.googleapis.com/auth/cloud-billing');
// Ensures we get a fresh token each time
googleProvider.setCustomParameters({
  prompt: 'consent'
});
// Removed cloud-identity scope due to authorization issues

export { app, analytics, auth, googleProvider };
