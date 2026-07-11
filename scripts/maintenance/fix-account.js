// [INTERNAL MAINTENANCE ONLY]
// Requires local .env
// MUST NOT be run in production without founder approval
const admin = require('firebase-admin');
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

async function fix() {
  const targetId = process.argv[2];
  if (!targetId) {
    console.error("Please provide a UID");
    process.exit(1);
  }
  const docRef = db.collection('users').doc(targetId);
  await docRef.update({
    user_id: targetId,
    referral_code: 'Hau Hau_MASTER'
  });
  console.log("Fixed user account", targetId);
  process.exit(0);
}
fix();
