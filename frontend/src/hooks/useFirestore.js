import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  getDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";

// ─── Save a chat exchange ────────────────────────────────────────
export const saveChat = async (uid, userMessage, airaResponse) => {
  try {
    await addDoc(collection(db, "users", uid, "chats"), {
      userMessage,
      airaResponse,
      timestamp: serverTimestamp(),
      mode: "voice"
    });
  } catch (e) {
    // Silently fail — Firestore rules may block, don't crash UI
    console.warn("saveChat failed:", e.code);
  }
};

// ─── Fetch recent chats for context display ──────────────────────
export const fetchRecentChats = async (uid, count = 10) => {
  try {
    const q = query(
      collection(db, "users", uid, "chats"),
      orderBy("timestamp", "desc"),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => d.data())
      .reverse() // oldest first for display
      .map(d => ({
        user: d.userMessage,
        aira: d.airaResponse
      }));
  } catch (e) {
    console.warn("fetchRecentChats failed:", e.code);
    return [];
  }
};

// ─── Save / update user memory string ───────────────────────────
export const saveMemory = async (uid, memoryText) => {
  try {
    await setDoc(doc(db, "users", uid, "memory", "core"), {
      text: memoryText,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("saveMemory failed:", e.code);
  }
};

// ─── Fetch user memory string ────────────────────────────────────
export const fetchMemory = async (uid) => {
  try {
    const snap = await getDoc(doc(db, "users", uid, "memory", "core"));
    return snap.exists() ? snap.data().text : null;
  } catch (e) {
    console.warn("fetchMemory failed:", e.code);
    return null;
  }
};

// ─── Save session summary ────────────────────────────────────────
export const saveSessionEvaluation = async (uid, sessionId, evaluation, scenario) => {
  try {
    await setDoc(doc(db, "users", uid, "performance", sessionId), {
      ...evaluation,
      scenario,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn("saveSessionEvaluation failed:", e.code);
  }
};
