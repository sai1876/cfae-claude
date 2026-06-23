import { NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as xlsx from 'xlsx';
import { rateLimit } from '@/lib/rateLimit';

export async function GET(req: Request) {
  // 1. Check API Secret Key
  const authHeader = req.headers.get('authorization');
  const apiSecret = process.env.API_SECRET_KEY;
  if (!apiSecret || authHeader !== `Bearer ${apiSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Rate Limiting (2 requests per minute per IP to prevent DoS)
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success: rateLimitSuccess } = rateLimit(`backup:${ip}`, 2, 60 * 1000);
  if (!rateLimitSuccess) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  try {
    const wb = xlsx.utils.book_new();
    const collectionsToBackup = ['users', 'orders', 'menu', 'stocks', 'offers', 'staff'];
    
    const collectionPromises = collectionsToBackup.map(async (colName) => {
      const snap = await getDocs(collection(db, colName));
      const data: any[] = [];
      
      snap.forEach(doc => {
        const docData = doc.data();
        
        // Flatten nested objects to string for Excel compatibility
        if (colName === 'orders' && docData.items) {
          docData.items = JSON.stringify(docData.items);
        }
        if (colName === 'users' && docData.stress_coupons_issued) {
          docData.stress_coupons_issued = JSON.stringify(docData.stress_coupons_issued);
        }
        
        data.push({ id: doc.id, ...docData });
      });
      
      return { colName, data };
    });

    const results = await Promise.all(collectionPromises);

    results.forEach(({ colName, data }) => {
      const ws = xlsx.utils.json_to_sheet(data.length ? data : [{ message: 'No data' }]);
      xlsx.utils.book_append_sheet(wb, ws, colName.charAt(0).toUpperCase() + colName.slice(1));
    });

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="cafe-backup-${new Date().toISOString().slice(0, 10)}.xlsx"`
      }
    });

  } catch (error) {
    console.error('Backup export failed:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
