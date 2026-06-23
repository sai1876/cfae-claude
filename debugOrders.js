const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// Load env variables manually
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    })
  });
}

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection("orders").get();
  console.log("Total orders in DB:", snapshot.size);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- Order: ${doc.id}`);
    console.log(`  status: "${data.status}"`);
    console.log(`  outlet: "${data.outlet}"`);
    console.log(`  hatch: "${data.hatch}"`);
    console.log(`  created_at: ${data.created_at} (${new Date(data.created_at).toISOString()})`);
    console.log(`  gross_amount: ${data.gross_amount}`);
    console.log(`  order_type: "${data.order_type}"`);
    console.log(`  items:`, JSON.stringify(data.items));
  });
}

run().catch(console.error);
