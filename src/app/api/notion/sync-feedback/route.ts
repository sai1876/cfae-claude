// [INTERNAL] - Route used by server-to-server or webhook calls
import { NextResponse } from 'next/server';
import { syncFeedbackToNotion } from '@/lib/notionService';

export async function POST(request: Request) {
  // Check API Secret Key
  const authHeader = request.headers.get('authorization');
  const apiSecret = process.env.API_SECRET_KEY;
  if (!apiSecret || authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    
    await syncFeedbackToNotion(data);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Notion API sync-feedback failed:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error'}, { status: 500 });
  }
}
