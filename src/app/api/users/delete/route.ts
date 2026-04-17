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

    // ── Attempt to delete from Firebase Auth via Admin SDK ────────────────
    // This is best-effort: if Admin SDK credentials are unavailable in the
    // current environment the Firestore deletion (handled client-side) still
    // succeeds and we return a flag so the dialog can surface a warning.
    try {
      const auth = adminAuth();

      if (auth) {
        await auth.deleteUser(uid);
      } else {
        return NextResponse.json({ success: true, adminUnavailable: true });
      }
    } catch (authError: unknown) {
      const err = authError as { code?: string };

      if (err.code !== 'auth/user-not-found') {
        // Admin SDK threw (e.g. missing project ID / ADC not configured).
        // Log it but let the client know so it can surface a warning.
        console.warn('Admin SDK Auth deletion failed (best-effort):', authError);
        return NextResponse.json({ success: true, adminUnavailable: true });
      }
      // auth/user-not-found: already gone from Auth — continue to success
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in user delete route:', error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err.message ?? 'Failed to delete user' },
      { status: 500 },
    );
  }
}
