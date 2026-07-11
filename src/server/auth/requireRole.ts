import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { USERS_COL } from '@/lib/firebase/collections';

export interface AuthContext {
  uid: string;
  email?: string;
  role: string;
}

/**
 * Validates the Authorization header, verifies the Firebase ID token,
 * fetches the user's role from Firestore (or token claims), and ensures
 * they have one of the `allowedRoles`.
 * 
 * Returns the AuthContext if successful, or a NextResponse error if unauthorized.
 */
export async function requireRole(req: Request, allowedRoles: string[]): Promise<AuthContext | NextResponse> {
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ detail: 'Firebase Admin not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (err) {
    return NextResponse.json({ detail: 'Invalid Firebase ID token' }, { status: 401 });
  }

  const uid = decodedToken.uid;
  const email = decodedToken.email;

  // Try to get role from token claims first
  let userRole = decodedToken.role as string;

  // Fallback to Firestore if claim isn't present
  if (!userRole) {
    try {
      const userDoc = await adminDb.collection(USERS_COL).doc(uid).get();
      if (userDoc.exists) {
        userRole = userDoc.data()?.role || 'customer';
      } else {
        userRole = 'customer';
      }
    } catch (err) {
      console.error("Failed to fetch user role from Firestore:", err);
      return NextResponse.json({ detail: 'Internal server error verifying role' }, { status: 500 });
    }
  }

  if (!allowedRoles.includes(userRole)) {
    console.warn(`[AUDIT] Forbidden access attempt by ${uid} (Role: ${userRole}). Required: ${allowedRoles.join(', ')}`);
    return NextResponse.json({ detail: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  return { uid, email, role: userRole };
}
