// [INTERNAL MAINTENANCE ONLY]
// Requires local .env
// MUST NOT be run in production without founder approval
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

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

async function seedAuthEmails() {
  try {
    let count = 0;
    
    // Fetch all users from Firebase Authentication directly!
    const listUsersResult = await admin.auth().listUsers(1000);
    
    for (const userRecord of listUsersResult.users) {
      if (userRecord.email) {
        const url = `${process.env.UPSTASH_REDIS_EMAIL_REST_URL}/sadd/registered_emails/${encodeURIComponent(userRecord.email.toLowerCase())}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_EMAIL_REST_TOKEN}`
          }
        });
        
        if (res.ok) {
          count++;
          console.log(`Cached auth email for user: ${userRecord.uid}`);
        } else {
          console.error(`Failed to cache email for user: ${userRecord.uid}`, await res.text());
        }
      }
    }
    
    console.log(`Successfully seeded ${count} user emails directly from Firebase Auth into Redis!`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedAuthEmails();
