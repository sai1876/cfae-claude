import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { adminDb } from '@/lib/firebaseAdmin';
import { STOCKS_COL, OUTLETS_COL, CONVERSION_RECIPES_COL, MENU_COL, WASTAGE_COL, STOCK_MOVEMENTS_COL } from '@/lib/firebase/collections';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ['owner', 'manager']);
    if (auth instanceof NextResponse) return auth;
    if (!adminDb) return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });

    const [stocksSnap, outletsSnap, recipesSnap, menuSnap, wastageSnap, movementsSnap] = await Promise.all([
      adminDb.collection(STOCKS_COL).get(),
      adminDb.collection(OUTLETS_COL).get(),
      adminDb.collection(CONVERSION_RECIPES_COL).get(),
      adminDb.collection(MENU_COL).get(),
      adminDb.collection(WASTAGE_COL).orderBy('timestamp', 'desc').limit(100).get(),
      adminDb.collection(STOCK_MOVEMENTS_COL).orderBy('timestamp', 'desc').limit(100).get()
    ]);

    return NextResponse.json({
      success: true,
      stocks: stocksSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      outlets: outletsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      recipes: recipesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      menuItems: menuSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      wastage: wastageSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      movements: movementsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
