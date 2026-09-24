import admin from "firebase-admin";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let isInitialized = false;

/**
 * Parse service account credentials from environment variables.
 */
function getServiceAccountCredential() {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (rawKey && rawKey.trim()) {
    try {
      const trimmed = rawKey.trim();
      let jsonString = trimmed;
      // Handle base64 encoded JSON
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        jsonString = Buffer.from(trimmed, "base64").toString("utf-8");
      }
      const parsed = JSON.parse(jsonString);
      return cert(parsed);
    } catch (err) {
      console.warn("[Firebase Admin] Could not parse FIREBASE_SERVICE_ACCOUNT_KEY:", err.message);
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

  if (clientEmail && privateKey) {
    try {
      const formattedKey = privateKey.replace(/\\n/g, "\n");
      return cert({
        projectId,
        clientEmail,
        privateKey: formattedKey,
      });
    } catch (err) {
      console.warn("[Firebase Admin] Could not create cert from clientEmail/privateKey:", err.message);
    }
  }

  return null;
}

/**
 * Initialize Firebase Admin app singleton.
 */
export function getFirebaseAdmin() {
  const apps = getApps();
  let app;
  if (apps.length > 0) {
    app = apps[0];
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "aira-ai";
    const credential = getServiceAccountCredential();

    if (credential) {
      app = initializeApp({
        credential,
        projectId,
      });
    } else {
      // Default initialization with projectId (allows ID token verification via Google public keys)
      app = initializeApp({
        projectId,
      });
    }
    isInitialized = true;
  }

  // Defensive compatibility helpers for v14 modular migration
  if (!app.auth) {
    app.auth = () => getAuth(app);
  }
  if (!app.firestore) {
    app.firestore = () => getFirestore(app);
  }

  return app;
}

/**
 * In-memory test store used when AIRA_TEST_MODE is enabled or during local offline testing.
 */
const testFirestoreStore = new Map();

function createInMemoryDocRef(path) {
  return {
    get: async () => {
      const data = testFirestoreStore.get(path);
      return {
        exists: !!data,
        data: () => data || null,
      };
    },
    set: async (data, options) => {
      if (options?.merge && testFirestoreStore.has(path)) {
        testFirestoreStore.set(path, { ...testFirestoreStore.get(path), ...data });
      } else {
        testFirestoreStore.set(path, data);
      }
    },
    delete: async () => {
      testFirestoreStore.delete(path);
    },
    collection: (subCol) => createInMemoryColRef(`${path}/${subCol}`),
  };
}

function createInMemoryColRef(colPath) {
  return {
    doc: (docId) => createInMemoryDocRef(`${colPath}/${docId}`),
  };
}

/**
 * Get Firestore database instance.
 */
export function getAdminDb() {
  // If test mode is enabled or running locally without service account credentials,
  // provide an in-memory document store matching Firestore API
  const hasCredential = Boolean(getServiceAccountCredential() || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (process.env.AIRA_TEST_MODE === "true" || !hasCredential) {
    return {
      collection: (colName) => createInMemoryColRef(colName),
      _clearTestStore: () => testFirestoreStore.clear(),
      _getTestStore: () => testFirestoreStore,
    };
  }

  try {
    const app = getFirebaseAdmin();
    return getFirestore(app);
  } catch (err) {
    console.warn("[Firebase Admin Firestore] Fallback to in-memory store:", err.message);
    return {
      collection: (colName) => createInMemoryColRef(colName),
      _clearTestStore: () => testFirestoreStore.clear(),
      _getTestStore: () => testFirestoreStore,
    };
  }
}

/**
 * Extract token from request headers or query params.
 */
function extractTokenFromRequest(req) {
  if (!req) return null;

  // 1. Authorization header: "Bearer <token>"
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === "string") {
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      return parts[1];
    }
  }

  // 2. Query parameter: ?token=<token>
  if (req.query?.token && typeof req.query.token === "string") {
    return req.query.token.trim();
  }

  return null;
}

/**
 * Server-side Firebase ID token verification.
 * Derives and returns the authenticated user's Firebase UID.
 * Rejects forged or missing tokens.
 *
 * @param {object} req - HTTP request object
 * @returns {Promise<{ authenticated: boolean, user?: { uid: string, email?: string, name?: string }, error?: string }>}
 */
export async function verifyUserToken(req) {
  // Test mode hook for unit/integration testing
  if (process.env.AIRA_TEST_MODE === "true" || process.env.NODE_ENV === "test") {
    const testUid = req.headers?.["x-test-uid"] || req.query?.testUid;
    if (testUid && typeof testUid === "string" && testUid.trim()) {
      return {
        authenticated: true,
        user: {
          uid: testUid.trim(),
          email: req.headers?.["x-test-email"] || `${testUid.trim()}@example.com`,
          name: "Test User",
        },
      };
    }
  }

  const token = extractTokenFromRequest(req);
  if (!token) {
    return {
      authenticated: false,
      error: "Missing authentication token in Authorization header or query parameter.",
    };
  }

  try {
    const app = getFirebaseAdmin();
    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(token);

    if (!decoded || !decoded.uid) {
      return {
        authenticated: false,
        error: "Invalid token payload: missing UID.",
      };
    }

    return {
      authenticated: true,
      user: {
        uid: decoded.uid,
        email: decoded.email || null,
        name: decoded.name || null,
      },
    };
  } catch (err) {
    return {
      authenticated: false,
      error: `Token verification failed: ${err.message}`,
    };
  }
}
