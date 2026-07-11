import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ['owner']);
    if (auth instanceof NextResponse) return auth;

    // Simulate fetching allowed modules or configurations
    const allowed_modules = [
      'dashboard', 'menu', 'offers', 'inventory', 'crm', 
      'staff', 'outlets', 'atmosphere', 'approvals', 'orders', 
      'active_orders', 'refunds', 'wastage', 'daily_closings'
    ];

    return NextResponse.json({
      success: true,
      uid: auth.uid,
      email: auth.email,
      role: auth.role,
      outlet_id: 'Global Outlets',
      allowed_modules
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
