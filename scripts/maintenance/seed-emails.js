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
const db = admin.firestore();

async function seed() {
  try {
    const users = await db.collection('users').get();
    let count = 0;
    
    for (const doc of users.docs) {
      const data = doc.data();
      if (data.email) {
        const url = `${process.env.UPSTASH_REDIS_EMAIL_REST_URL}/sadd/registered_emails/${encodeURIComponent(data.email.toLowerCase())}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_EMAIL_REST_TOKEN}`
          }
        });
        
        if (res.ok) {
          count++;
          console.log(`Cached email for user: ${doc.id}`);
        } else {
          console.error(`Failed to cache email for user: ${doc.id}`, await res.text());
        }
      }
    }
    console.log(`Successfully seeded ${count} existing user emails into Redis!`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
