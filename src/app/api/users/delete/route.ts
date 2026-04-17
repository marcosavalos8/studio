import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid } = body as { uid?: string };

    if (!uid) {
      return NextResponse.json(
        { error: 'Missing required field: uid' },
        { status: 400 },
      );
    }

    const auth = adminAuth();

    if (!auth) {
      // Admin SDK unavailable (e.g. local dev without ADC).
      // Return a specific error so the client can surface a helpful message.
      return NextResponse.json(
        {
          error:
            'Firebase Admin SDK is not available in this environment. ' +
            'The Firestore record has been deleted, but the Firebase Authentication ' +
            'account could not be removed automatically. Please delete it manually ' +
            'from the Firebase Console.',
          adminUnavailable: true,
        },
        { status: 503 },
      );
    }

    await auth.deleteUser(uid);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting user from Firebase Auth:', error);

    // firebase-admin throws objects with a `code` property for known errors
    const authError = error as { code?: string; message?: string };

    if (authError.code === 'auth/user-not-found') {
      // User doesn't exist in Auth — treat as success (already gone)
      return NextResponse.json({ success: true, notFound: true });
    }

    return NextResponse.json(
      { error: authError.message ?? 'Failed to delete user from Firebase Auth' },
      { status: 500 },
    );
  }
}
