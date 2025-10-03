import { initializeApp, getApps, App, cert } from 'firebase-admin/app';

// IMPORTANT: Do not expose this to the client-side.
// This is a server-only file.

// Load service account from environment variable
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null;

/**
 * Initializes and returns a Firebase Admin app instance.
 * It's a singleton; it initializes the app only once.
 */
export async function initializeServerApp(): Promise<App> {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set. This is required for server-side authentication.');
  }

  const app = initializeApp({
    credential: cert(serviceAccount),
    // You can add your databaseURL here if you have it
    // databaseURL: `https://<YOUR_PROJECT_ID>.firebaseio.com`
  });

  return app;
}
