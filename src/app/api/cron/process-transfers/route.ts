import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { Staff } from '@/lib/types';

export async function GET(request: Request) {
  // Check API Secret Key
  const authHeader = request.headers.get('authorization');
  const apiSecret = process.env.API_SECRET_KEY;
  if (!apiSecret || authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!adminDb || !adminAuth) {
      throw new Error("Firebase Admin not configured");
    }

    const staffSnap = await adminDb.collection('staff').get();
    const now = Date.now();

    const transferPromises = staffSnap.docs.map(async (doc) => {
      const staff = doc.data() as Staff;

      if (staff.pending_transfer && staff.pending_transfer.effective_time <= now) {
        // Time to execute transfer!
        const targetOutlet = staff.pending_transfer.target_outlet;

        // 1. Update Auth Claims
        if (staff.email) {
          try {
            await adminAuth.setCustomUserClaims(staff.id, {
              role: staff.role,
              outlet: targetOutlet
            });
          } catch (e) {
            console.error(`Failed to update claims for ${staff.email}`, e);
            return 0; // Skip DB update if auth fails to prevent desync
          }
        }

        // 2. Update DB
        const updatedStaff = { ...staff };
        updatedStaff.outlet = targetOutlet;
        delete updatedStaff.pending_transfer;

        await adminDb.collection('staff').doc(staff.id).set(updatedStaff);
        
        console.log(`Processed transfer for ${staff.name} to ${targetOutlet}`);
        return 1;
      }
      return 0;
    });

    const results = await Promise.all(transferPromises);
    const processedCount = results.reduce((sum, count) => sum + count, 0);

    return NextResponse.json({ success: true, processed: processedCount });

  } catch (error: any) {
    console.error("Cron Error: ", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}