import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export async function POST(request: Request) {
  try {
    const { idToken, action, totpCode } = await request.json();

    if (!idToken || !action) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    if (action === 'init') {
      const secretDoc = await adminDb.collection('admin_secrets').doc(uid).get();
      
      if (secretDoc.exists) {
        // Returning user, requires TOTP verification
        return NextResponse.json({ require_totp: true });
      } else {
        // First-time setup
        const secret = authenticator.generateSecret();
        
        // Save temp secret (user must verify to activate)
        await adminDb.collection('admin_secrets').doc(uid).set({
          secret,
          verified: false
        });

        const otpauth = authenticator.keyuri(decodedToken.email || 'Owner', 'Hau Hau Admin Telemetry', secret);
        const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
        
        return NextResponse.json({ 
          setup_required: true, 
          qrCodeDataUrl,
          secret // Send secret string as fallback for manual entry
        });
      }
    }

    if (action === 'verify') {
      if (!totpCode) {
        return NextResponse.json({ error: 'Missing TOTP code' }, { status: 400 });
      }

      const secretDoc = await adminDb.collection('admin_secrets').doc(uid).get();
      if (!secretDoc.exists) {
        return NextResponse.json({ error: '2FA setup required' }, { status: 400 });
      }

      const { secret } = secretDoc.data()!;
      const isValid = authenticator.verify({ token: totpCode, secret });

      if (isValid) {
        // Mark as verified
        await adminDb.collection('admin_secrets').doc(uid).update({ verified: true });
        
        // Create session cookie
        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
        
        let redirectUrl = '/admin';
        try {
          const staffQuery = await adminDb.collection('staff').where('email', '==', decodedToken.email).limit(1).get();
          if (!staffQuery.empty) {
            const role = staffQuery.docs[0].data().role;
            if (['deep_fryer', 'grill_fryer', 'biryani_master', 'brewer'].includes(role)) {
              redirectUrl = '/kds';
            } else if (role === 'rider') {
              redirectUrl = '/delivery';
            } else if (role === 'manager') {
              redirectUrl = '/manager';
            }
          }
        } catch (e) {
          console.error("Failed to fetch role for redirect", e);
        }

        const response = NextResponse.json({ success: true, redirectUrl });
        response.cookies.set('__session', sessionCookie, {
          maxAge: expiresIn,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          path: '/',
        });

        return response;
      } else {
        return NextResponse.json({ error: 'Invalid TOTP code' }, { status: 401 });
      }
    }

    if (action === 'logout') {
        const response = NextResponse.json({ success: true });
        response.cookies.delete('__session');
        return response;
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}