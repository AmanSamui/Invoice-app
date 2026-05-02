import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, doc, orderBy } from "firebase/firestore";

// Your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA45PVcyaRl1NXt0Vxz_uZKZN2uD9fEj10",
  authDomain: "invoice-app-51f5c.firebaseapp.com",
  projectId: "invoice-app-51f5c",
  storageBucket: "invoice-app-51f5c.firebasestorage.app",
  messagingSenderId: "481470876559",
  appId: "1:481470876559:web:e65268b7afaad6f1e259fa",
  measurementId: "G-ZLF9SK7YXW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { 
    auth, db, googleProvider, 
    signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut,
    collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, doc, orderBy
};
