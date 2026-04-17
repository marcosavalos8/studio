import { NextRequest, NextResponse } from 'next/server';
import { firebaseConfig } from '@/firebase/config';

// Firebase Auth REST API endpoints
const FIREBASE_AUTH_SIGNUP_API = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, displayName, role, status } = body as {
      email?: string;
      password?: string;
      displayName?: string;
      role?: string;
      status?: string;
    };

    // Validate required fields
    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const API_KEY = firebaseConfig.apiKey;
    if (!API_KEY) {
      console.error('Firebase API key not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // ── Attempt 1: create via REST API ────────────────────────────────────
    const { uid, errorMessage } = await signupViaRestApi(API_KEY, email, password, displayName);

    if (uid) {
      console.log('User created successfully:', { uid, email, displayName, role, status });
      return NextResponse.json(
        { success: true, uid, message: 'User created successfully' },
        { status: 200 },
      );
    }

    // If the email already exists, try to clean up the orphaned Auth account via
    // Admin SDK and then retry. This handles the case where a user was deleted from
    // Firestore only (without the corresponding Auth account being removed).
    if (errorMessage === 'EMAIL_EXISTS') {
      const cleaned = await tryCleanupOrphanedAuthAccount(email);
      if (cleaned) {
        // Retry creation after removing the orphaned account
        const { uid: retryUid, errorMessage: retryError } = await signupViaRestApi(
          API_KEY,
          email,
          password,
          displayName,
        );

        if (retryUid) {
          console.log('User recreated after orphan cleanup:', { uid: retryUid, email });
          return NextResponse.json(
            { success: true, uid: retryUid, message: 'User created successfully' },
            { status: 200 },
          );
        }

        console.error('Retry after orphan cleanup failed:', retryError);
        return NextResponse.json(
          { error: retryError ?? 'Failed to create user after cleanup' },
          { status: 400 },
        );
      }

      // Could not clean up via Admin SDK (not available in this environment).
      // The orphaned account must be removed manually from the Firebase Console.
      return NextResponse.json(
        {
          error:
            'A Firebase Authentication account with this email already exists but has no ' +
            'matching user record. Please delete the account from the Firebase Console ' +
            '(Authentication → Users) and try again.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: errorMessage ?? 'Failed to create user in Firebase Auth' },
      { status: 400 },
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 },
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function signupViaRestApi(
  apiKey: string,
  email: string,
  password: string,
  displayName: string,
): Promise<{ uid?: string; errorMessage?: string }> {
  const res = await fetch(`${FIREBASE_AUTH_SIGNUP_API}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
  });

  if (res.ok) {
    const data = await res.json();
    return { uid: data.localId as string };
  }

  const errorData = await res.json();
  console.error('Firebase Auth REST error:', errorData);
  return { errorMessage: (errorData.error?.message as string | undefined) ?? 'Unknown error' };
}

/**
 * Attempt to delete an orphaned Firebase Auth account (one that exists in Auth
 * but not in Firestore) using the Admin SDK.
 *
 * Returns true if the account was successfully removed, false otherwise (e.g.
 * when Admin SDK credentials are unavailable in the current environment).
 */
async function tryCleanupOrphanedAuthAccount(email: string): Promise<boolean> {
  try {
    const { adminAuth } = await import('@/lib/firebase-admin');
    const auth = adminAuth();
    if (!auth) return false;

    const existingUser = await auth.getUserByEmail(email);
    await auth.deleteUser(existingUser.uid);
    console.log('Deleted orphaned Auth account for:', email);
    return true;
  } catch (err) {
    // Admin SDK not available or call failed — caller will show a user-friendly message
    console.warn('Could not clean up orphaned Auth account via Admin SDK:', err);
    return false;
  }
}


