import * as admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 * For production, you should use a service account key file
 * For this implementation, we'll use application default credentials
 */
export function getAdminApp(): admin.app.App | null {
  if (adminApp) {
    return adminApp;
  }

  try {
    // Try to get existing app
    adminApp = admin.app();
  } catch (error) {
    // Initialize new app
    // In production, you would use:
    // adminApp = admin.initializeApp({
    //   credential: admin.credential.cert(serviceAccountKey),
    //   projectId: 'your-project-id'
    // });
    
    // For this sandbox environment, we'll use a simplified approach
    // The client-side Firebase SDK will handle authentication
    console.warn('Firebase Admin SDK not properly configured. User creation will use client-side SDK.');
    return null;
  }

  return adminApp;
}

export const adminAuth = () => {
  const app = getAdminApp();
  return app ? admin.auth(app) : null;
};

export const adminFirestore = () => {
  const app = getAdminApp();
  return app ? admin.firestore(app) : null;
};
