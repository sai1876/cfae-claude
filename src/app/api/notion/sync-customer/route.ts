import { NextResponse } from 'next/server';
import { syncCustomerToNotion } from '@/lib/notionService';

export async function POST(request: Request) {
  // Check API Secret Key
  const authHeader = request.headers.get('authorization');
  const apiSecret = process.env.API_SECRET_KEY;
  if (!apiSecret || authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    
    // Non-blocking execution (don't await if we don't want to hold up the response)
    // Next.js API routes might require awaiting to finish execution before lambda dies
    await syncCustomerToNotion(data);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Notion API sync-customer failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
