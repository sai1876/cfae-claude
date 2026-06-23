import { NextResponse } from 'next/server';
import { syncOrderToNotion } from '@/lib/notionService';

export async function POST(request: Request) {
  // Check API Secret Key
  const authHeader = request.headers.get('authorization');
  const apiSecret = process.env.API_SECRET_KEY;
  if (!apiSecret || authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    
    await syncOrderToNotion(data);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Notion API sync-order failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
