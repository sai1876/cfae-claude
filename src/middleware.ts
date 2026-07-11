import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('__session');
  
  if (!session) {
    // If there's no session cookie, redirect to the new secure login page
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  // Protect all secure routes
  matcher: ['/admin/:path*', '/admin', '/manager/:path*', '/manager', '/kds/:path*', '/kds', '/delivery/:path*', '/delivery'],
};
