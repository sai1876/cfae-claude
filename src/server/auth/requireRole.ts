import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { USERS_COL, STAFF_COL } from '@/lib/firebase/collections';

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

  // Fallback to Firestore USERS_COL if claim isn't present
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

  // Strict STAFF_COL Fallback
  if (!userRole || userRole === 'customer') {
    if (decodedToken.email && decodedToken.email_verified === true) {
      try {
        const normalizedEmail = decodedToken.email.toLowerCase();
        const staffDocs = await adminDb.collection(STAFF_COL).where('email', '==', normalizedEmail).get();
        
        if (staffDocs.size > 1) {
          console.warn(`[SECURITY] Multiple staff docs found for email: ${normalizedEmail}`);
          return NextResponse.json({ detail: 'Forbidden: Security conflict' }, { status: 403 });
        } else if (staffDocs.size === 1) {
          const staffData = staffDocs.docs[0].data();
          const docId = staffDocs.docs[0].id;
          const validAppRoles = ['owner', 'admin', 'manager', 'deep_fryer', 'grill_fryer', 'biryani_master', 'brewer', 'rider'];
          
          if ((staffData.status === 'active' || staffData.status === 'enabled') && 
              staffData.role && 
              validAppRoles.includes(staffData.role)) {
            
            // If uid field exists, it must match decodedToken.uid
            let uidMatches = true;
            if (staffData.uid && staffData.uid !== uid) {
              uidMatches = false;
              console.warn(`[SECURITY] Staff doc uid mismatch for email: ${normalizedEmail}`);
            }
            // Also, since document ID is often used as uid in our system, if it looks like a uid and doesn't match:
            if (uidMatches && docId && docId !== uid && docId.length > 20) {
               // Many uids are > 20 chars, but this is just a loose check. We mainly rely on staffData.uid.
               // Let's stick strictly to what the prompt said: "staff document has uid matching decodedToken.uid if uid field exists"
            }

            if (uidMatches) {
              userRole = staffData.role;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch staff role from Firestore:", err);
      }
    }
  }

  if (!allowedRoles.includes(userRole)) {
    console.warn(`[AUDIT] Forbidden access attempt by ${uid} (Role: ${userRole}). Required: ${allowedRoles.join(', ')}`);
    return NextResponse.json({ detail: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  return { uid, email, role: userRole };
}
