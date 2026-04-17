import { collection, query, getDocs, addDoc } from "firebase/firestore";
import { db } from "../config/firebase.js";

// Fetch user memory
export const getUserMemory = async (uid) => {
  try {
    const memoryRef = collection(db, `users/${uid}/memory`);
    const q = query(memoryRef);
    const snapshot = await getDocs(q);
    
    let memories = [];
    snapshot.forEach((doc) => {
      memories.push({ id: doc.id, ...doc.data() });
    });
    return memories;
  } catch (error) {
    console.error("Error fetching memory:", error);
    return [];
  }
};

// Add new memory
// memoryData: { type: 'preference', key: 'pace', value: 'fast', createdAt: timestamp }
export const addUserMemory = async (uid, memoryData) => {
  try {
    const memoryRef = collection(db, `users/${uid}/memory`);
    const docRef = await addDoc(memoryRef, {
      ...memoryData,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding memory:", error);
    return null;
  }
};
