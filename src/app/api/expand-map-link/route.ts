import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function GET(request: NextRequest) {
  // 1. Admin Authentication Check
  const session = request.cookies.get('__session');
  if (!session || !session.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminAuth) {
    return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
  }

  try {
    await adminAuth.verifySessionCookie(session.value, true);
  } catch (error) {
    console.error('Session verification failed in expand-map-link:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const urlParam = request.nextUrl.searchParams.get('url');
  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // 2. SSRF Protection - Strict Domain Whitelist
  if (!urlParam.startsWith('https://maps.app.goo.gl/') && 
      !urlParam.startsWith('https://goo.gl/maps/') && 
      !urlParam.startsWith('https://www.google.com/maps/')) {
    return NextResponse.json({ error: 'Invalid Google Maps URL. Security policy prevents fetching this domain.' }, { status: 403 });
  }

  try {
    // 3. Follow Redirects safely
    const res = await fetch(urlParam, {
      method: 'GET',
      redirect: 'follow',
    });

    const finalUrl = res.url;
    
    // 4. Regex extraction of Latitude and Longitude
    const coordsMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    
    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[2]);
      return NextResponse.json({ lat, lng, finalUrl });
    } else {
      const altMatch = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if (altMatch) {
        return NextResponse.json({ lat: parseFloat(altMatch[1]), lng: parseFloat(altMatch[2]), finalUrl });
      }
      return NextResponse.json({ error: 'Could not extract coordinates from the resolved URL' }, { status: 404 });
    }

  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to resolve URL', details: e.message }, { status: 500 });
  }
}