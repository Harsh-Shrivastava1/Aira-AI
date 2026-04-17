import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDSg1hePO_MNAiul8wpjWu8_quacoXurfg",
  authDomain: "aira-ai-79625.firebaseapp.com",
  projectId: "aira-ai-79625",
  storageBucket: "aira-ai-79625.firebasestorage.app",
  messagingSenderId: "1034895224427",
  appId: "1:1034895224427:web:d966f9e229ddbc4b4d4b2e",
  measurementId: "G-7R4EEF6Q7T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
