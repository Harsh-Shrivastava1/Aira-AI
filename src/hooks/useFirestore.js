import { db, auth } from "@/config/firebase";
import { API_BASE } from "../config/api";
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

/**
 * Ensures user document exists in Firestore
 */
export const syncUserDoc = async (user) => {
  if (!user) return;
  try {
    const userDocRef = doc(db, "users", user.uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      console.log("Creating new user document for:", user.uid);
      await setDoc(userDocRef, {
        name: user.displayName,
        email: user.email,
        createdAt: serverTimestamp()
      });
    }
  } catch (e) {
    console.warn("syncUserDoc failed:", e);
  }
};

// ─── Fetch the most recent active chat thread. If none exists, creates one.
export const getActiveChatId = async (uid) => {
  if (!auth.currentUser || !uid) return null;

  try {
    const q = query(
      collection(db, "users", uid, "threads"),
      orderBy("lastUpdated", "desc"),
      limit(10)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      // Find the most recent non-deleted thread
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        if (data.deleted !== true) {
          return docSnap.id;
        }
      }
    }
    // If no non-deleted thread exists, create a new one
    return await createNewThread(uid);
  } catch (e) {
    console.warn("getActiveChatId failed:", e.code);
    return Date.now().toString(); // fallback
  }
};

// ─── Create a new chat thread ────────────────────────────────────
export const createNewThread = async (uid) => {
  if (!auth.currentUser || !uid) return null;
  try {
    const docRef = await addDoc(collection(db, "users", uid, "threads"), {
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      title: "New Conversation",
      deleted: false,
      deletedAt: null
    });
    return docRef.id;
  } catch (e) {
    console.warn("createNewThread failed:", e.code);
    return Date.now().toString();
  }
};

// ─── Soft-delete a chat thread ──────────────────────────────────
export const softDeleteThread = async (uid, chatId) => {
  if (!auth.currentUser || !uid || !chatId) return false;
  try {
    const threadRef = doc(db, "users", uid, "threads", chatId);
    await setDoc(threadRef, {
      deleted: true,
      deletedAt: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (e) {
    console.error("softDeleteThread failed:", e);
    return false;
  }
};

// ─── Save a single message to a specific thread ──────────────────
export const saveMessage = async (uid, chatId, role, content, type = "text", emailDraft = null) => {
  if (!auth.currentUser || !uid || !chatId) return;
  try {
    await addDoc(collection(db, "users", uid, "threads", chatId, "messages"), {
      role,
      content,
      type,
      emailDraft,
      timestamp: serverTimestamp()
    });
    
    // Update thread lastUpdated and potentially the title
    const updates = { lastUpdated: serverTimestamp() };
    
    // If it's the first user message, generate a human-readable title asynchronously
    if (role === "user") {
      const threadRef = doc(db, "users", uid, "threads", chatId);
      const snap = await getDoc(threadRef);
      if (snap.exists()) {
        const currentTitle = snap.data().title;
        if (!currentTitle || currentTitle === "New Conversation" || currentTitle === "General Chat Started") {
          try {
            const resp = await fetch(`${API_BASE}/api/generate-title`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: content })
            });
            const data = await resp.json();
            if (data.title && data.title !== "New Conversation") {
              updates.title = data.title;
            } else if (content.length > 40) {
              updates.title = content.substring(0, 37) + "...";
            } else {
              updates.title = content;
            }
          } catch (e) {
            console.warn("AI Title gen failed, falling back to trim:", e);
            updates.title = content.length > 40 ? content.substring(0, 37) + "..." : content;
          }
        }
      }
    }

    await setDoc(doc(db, "users", uid, "threads", chatId), updates, { merge: true });
  } catch (e) {
    console.warn("saveMessage failed:", e.code);
  }
};

// ─── Fetch all active (non-deleted) threads for the user (History) ──
export const fetchAllThreads = async (uid) => {
  if (!auth.currentUser || !uid) return [];
  try {
    const q = query(
      collection(db, "users", uid, "threads"),
      orderBy("lastUpdated", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({
        id: d.id,
        ...d.data()
      }))
      .filter(t => t.deleted !== true);
  } catch (e) {
    console.warn("fetchAllThreads failed:", e.code);
    return [];
  }
};

// ─── Fetch previous messages for context (last N messages) ───────
export const fetchThreadMessages = async (uid, chatId, count = 20) => {
  if (!auth.currentUser) return [];
  try {
    const q = query(
      collection(db, "users", uid, "threads", chatId, "messages"),
      orderBy("timestamp", "desc"),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => d.data())
      .reverse()
      .map(d => ({
        role: d.role,
        content: d.content,
        type: d.type || "text",
        emailDraft: d.emailDraft || null,
        timestamp: d.timestamp
      }));
  } catch (e) {
    console.warn("fetchThreadMessages failed:", e.code);
    return [];
  }
};

// ─── Save / update user memory string ───────────────────────────
export const saveMemory = async (uid, memoryText) => {
  if (!auth.currentUser) return;
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
  if (!auth.currentUser) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid, "memory", "core"));
    return snap.exists() ? snap.data().text : null;
  } catch (e) {
    console.warn("fetchMemory failed:", e.code);
    return null;
  }
};

// ─── Save session evaluation ────────────────────────────────────────
export const saveSessionEvaluation = async (uid, sessionId, evaluation, scenario) => {
  if (!auth.currentUser) return;
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
