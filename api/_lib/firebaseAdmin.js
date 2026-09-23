import admin from "firebase-admin";

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
      return admin.credential.cert(parsed);
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
      return admin.credential.cert({
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
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "aira-ai";
  const credential = getServiceAccountCredential();

  if (credential) {
    admin.initializeApp({
      credential,
      projectId,
    });
  } else {
    // Default initialization with projectId (allows ID token verification via Google public keys)
    admin.initializeApp({
      projectId,
    });
  }

  isInitialized = true;
  return admin.app();
}

/**
 * In-memory test store used when AIRA_TEST_MODE is enabled or during local offline testing.
 */
const testFirestoreStore = new Map();

/**
 * Get Firestore database instance.
 */
export function getAdminDb() {
  // If test mode is enabled, provide an in-memory document store matching Firestore API
  if (process.env.AIRA_TEST_MODE === "true") {
    return {
      collection: (colName) => ({
        doc: (docId) => ({
          get: async () => {
            const key = `${colName}/${docId}`;
            const data = testFirestoreStore.get(key);
            return {
              exists: !!data,
              data: () => data || null,
            };
          },
          set: async (data, options) => {
            const key = `${colName}/${docId}`;
            if (options?.merge && testFirestoreStore.has(key)) {
              testFirestoreStore.set(key, { ...testFirestoreStore.get(key), ...data });
            } else {
              testFirestoreStore.set(key, data);
            }
          },
          delete: async () => {
            const key = `${colName}/${docId}`;
            testFirestoreStore.delete(key);
          },
        }),
      }),
      _clearTestStore: () => testFirestoreStore.clear(),
      _getTestStore: () => testFirestoreStore,
    };
  }

  try {
    const app = getFirebaseAdmin();
    return app.firestore();
  } catch (err) {
    console.warn("[Firebase Admin Firestore] Fallback to in-memory store:", err.message);
    return {
      collection: (colName) => ({
        doc: (docId) => ({
          get: async () => {
            const key = `${colName}/${docId}`;
            const data = testFirestoreStore.get(key);
            return {
              exists: !!data,
              data: () => data || null,
            };
          },
          set: async (data, options) => {
            const key = `${colName}/${docId}`;
            if (options?.merge && testFirestoreStore.has(key)) {
              testFirestoreStore.set(key, { ...testFirestoreStore.get(key), ...data });
            } else {
              testFirestoreStore.set(key, data);
            }
          },
          delete: async () => {
            const key = `${colName}/${docId}`;
            testFirestoreStore.delete(key);
          },
        }),
      }),
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
    const parts = authHeader.trim().split(" ");
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
    const decoded = await app.auth().verifyIdToken(token);

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
