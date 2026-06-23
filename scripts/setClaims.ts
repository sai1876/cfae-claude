import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  console.error("Missing Firebase Admin environment variables in .env.local.");
  process.exit(1);
}

// Initialize Admin SDK
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
});

async function setRole() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: npx tsx scripts/setClaims.ts <email> <role>");
    console.error("Example: npx tsx scripts/setClaims.ts owner@cafe.com admin");
    process.exit(1);
  }

  const email = args[0];
  const role = args[1];

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { role });
    console.log(`Successfully set role '${role}' for user ${email} (uid: ${user.uid}).`);
    process.exit(0);
  } catch (error) {
    console.error("Error setting custom claims:", error);
    process.exit(1);
  }
}

setRole();
