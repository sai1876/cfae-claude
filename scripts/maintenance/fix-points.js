// [INTERNAL MAINTENANCE ONLY]
// Requires local .env
// MUST NOT be run in production without founder approval
const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    })
  });
}

const db = admin.firestore();

async function fixPoints() {
  try {
    const targetPhone = process.argv[2];
    if (!targetPhone) {
      console.error("Please provide a phone number");
      process.exit(1);
    }
    // 1. Find the referrer
    const referrerSnap = await db.collection('users').where('phone', '==', targetPhone).get();
    if (referrerSnap.empty) {
      console.log("Referrer not found");
      return;
    }
    const referrerDoc = referrerSnap.docs[0];
    const referrerData = referrerDoc.data();
    
    // Add 50 points to user doc
    await referrerDoc.ref.update({
      points: (referrerData.points || 0) + 50
    });
    
    // Create point_ledger entry
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 45);
    
    await db.collection('point_ledger').add({
      user_id: referrerDoc.id,
      amount: 50,
      original_amount: 50,
      source: 'referral_bonus',
      expires_at: expDate.toISOString(),
      is_expired: false,
      created_at: Date.now()
    });
    
    console.log("Successfully retroactively granted 50 points and ledger to referrer", targetPhone);
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
}

fixPoints();
