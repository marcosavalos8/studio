import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { firebaseConfig } from '@/firebase/config';

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

    const auth = adminAuth();

    if (!auth) {
      // Admin SDK unavailable — fall back to the REST API
      return await createViaRestApi(email, password, displayName);
    }

    // ── Try to create the user via Admin SDK ──────────────────────────────
    try {
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
      });

      console.log('User created successfully:', { uid: userRecord.uid, email, displayName, role, status });

      return NextResponse.json(
        { success: true, uid: userRecord.uid, message: 'User created successfully' },
        { status: 200 },
      );
    } catch (createError: unknown) {
      const authError = createError as { code?: string; message?: string };

      // If the email already exists in Auth but NOT in Firestore (orphaned account),
      // delete the old Auth account and recreate it so the user can be re-registered.
      if (authError.code === 'auth/email-already-exists') {
        try {
          // Look up the existing Auth user by email
          const existingUser = await auth.getUserByEmail(email);

          // Delete the orphaned Auth account
          await auth.deleteUser(existingUser.uid);

          // Recreate with the new credentials
          const newUserRecord = await auth.createUser({
            email,
            password,
            displayName,
          });

          console.log('Recreated orphaned user:', { uid: newUserRecord.uid, email });

          return NextResponse.json(
            { success: true, uid: newUserRecord.uid, message: 'User created successfully' },
            { status: 200 },
          );
        } catch (retryError: unknown) {
          const retryAuthError = retryError as { message?: string };
          console.error('Failed to recreate orphaned user:', retryError);
          return NextResponse.json(
            { error: retryAuthError.message ?? 'Failed to create user' },
            { status: 500 },
          );
        }
      }

      // Any other Auth error
      console.error('Firebase Admin createUser error:', createError);
      return NextResponse.json(
        { error: authError.message ?? 'Failed to create user in Firebase Auth' },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 },
    );
  }
}

// ─── REST API fallback (used when Admin SDK is unavailable) ───────────────────

const FIREBASE_AUTH_SIGNUP_API = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';
const FIREBASE_AUTH_LOOKUP_API = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
const FIREBASE_AUTH_DELETE_API = 'https://identitytoolkit.googleapis.com/v1/accounts:delete';

async function createViaRestApi(
  email: string,
  password: string,
  displayName: string,
): Promise<NextResponse> {
  const API_KEY = firebaseConfig.apiKey;

  if (!API_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const signupRes = await fetch(`${FIREBASE_AUTH_SIGNUP_API}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
  });

  if (signupRes.ok) {
    const data = await signupRes.json();
    return NextResponse.json({ success: true, uid: data.localId, message: 'User created successfully' });
  }

  const errorData = await signupRes.json();
  console.error('Firebase Auth REST error:', errorData);

  if (errorData.error?.message !== 'EMAIL_EXISTS') {
    return NextResponse.json(
      { error: errorData.error?.message ?? 'Failed to create user in Firebase Auth' },
      { status: 400 },
    );
  }

  // EMAIL_EXISTS — orphaned Auth account. Cannot delete via REST API without
  // the user's own ID token. Return a descriptive error asking the admin to
  // remove the account from the Firebase Console.
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
