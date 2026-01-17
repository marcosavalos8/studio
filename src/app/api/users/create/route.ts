import { NextRequest, NextResponse } from 'next/server';
import { firebaseConfig } from '@/firebase/config';

// Firebase Auth REST API endpoint
const FIREBASE_AUTH_API = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';
const API_KEY = firebaseConfig.apiKey;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, displayName, role, status } = body;

    // Validate required fields
    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!API_KEY) {
      console.error('Firebase API key not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Create user using Firebase Auth REST API
    const authResponse = await fetch(`${FIREBASE_AUTH_API}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        displayName,
        returnSecureToken: true,
      }),
    });

    if (!authResponse.ok) {
      const errorData = await authResponse.json();
      console.error('Firebase Auth error:', errorData);
      
      // Handle specific Firebase errors
      if (errorData.error?.message === 'EMAIL_EXISTS') {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to create user in Firebase Auth' },
        { status: 400 }
      );
    }

    const authData = await authResponse.json();
    const uid = authData.localId;

    console.log('User created successfully:', { uid, email, displayName, role, status });
    
    return NextResponse.json(
      { 
        success: true, 
        uid,
        message: 'User created successfully'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
