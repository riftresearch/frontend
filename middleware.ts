import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BLOCKED_COUNTRIES = ['KP', 'RU', 'IR', 'CH']; // North Korea, Russia, Iran, Switzerland

export function middleware(request: NextRequest) {
  const country = request.geo?.country || 'Unknown';
  const ip = request.ip || 'Unknown';
  const path = request.nextUrl.pathname;
  
  console.log(`[Middleware] Request from country: ${country}, IP: ${ip}, Path: ${path}`);
  
  if (path === '/blocked') {
    console.log('[Middleware] Allowing access to blocked page');
    return NextResponse.next();
  }

  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path === '/favicon.ico'
  ) {
    console.log('[Middleware] Allowing access to static asset or API route');
    return NextResponse.next();
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Middleware] Development mode - redirecting to blocked page');
    return NextResponse.redirect(new URL('/blocked', request.url));
  }
  
  if (country && BLOCKED_COUNTRIES.includes(country)) {
    console.log(`[Middleware] Blocking access from ${country}`);
    return NextResponse.redirect(new URL('/blocked', request.url));
  }
  
  console.log(`[Middleware] Allowing access from ${country}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    '/((?!api|_next/static|_next/image|favicon.ico|blocked).*)',
  ],
};
