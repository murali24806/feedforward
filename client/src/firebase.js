import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCApPMyAAYMBS6NVAyrewVRbYNFwCPZefM",
  authDomain: "feedforward-4124b.firebaseapp.com",
  projectId: "feedforward-4124b",
  storageBucket: "feedforward-4124b.firebasestorage.app",
  messagingSenderId: "829094655089",
  appId: "1:829094655089:web:7eacbe2a1fa7d7bdcd57d0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error) {
    console.error("Firebase Google Auth Error:", error);
    throw error;
  }
};
