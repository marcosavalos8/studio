import * as admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK.
 * On Google Cloud environments (Firebase App Hosting / Cloud Run) Application Default
 * Credentials (ADC) are available automatically, so no credential configuration is needed.
 */
export function getAdminApp(): admin.app.App | null {
  if (adminApp) {
    return adminApp;
  }

  // Try to reuse an already-initialized app
  try {
    adminApp = admin.app();
    return adminApp;
  } catch {
    // App not yet initialized — fall through
  }

  // Initialize with ADC (works on Cloud Run / Firebase App Hosting automatically)
  try {
    adminApp = admin.initializeApp();
    return adminApp;
  } catch (error) {
    console.error(
      'Firebase Admin SDK initialization failed. User auth operations requiring Admin SDK will be unavailable.',
      error,
    );
    return null;
  }
}

export const adminAuth = () => {
  const app = getAdminApp();
  return app ? admin.auth(app) : null;
};

export const adminFirestore = () => {
  const app = getAdminApp();
  return app ? admin.firestore(app) : null;
};
