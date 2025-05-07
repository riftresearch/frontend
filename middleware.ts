import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BLOCKED_COUNTRIES = ['KP', 'RU', 'IR', 'CH']; // North Korea, Russia, Iran, Switzerland

const SIMULATE_BLOCKED_COUNTRY = true;

const isServer = typeof window === 'undefined';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/blocked') {
    return NextResponse.next();
  }

  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  if (process.env.NODE_ENV === 'development' && SIMULATE_BLOCKED_COUNTRY) {
    console.log('[Middleware] Simulating request from blocked country');
    return NextResponse.redirect(new URL('/blocked', request.url));
  }

  const country = request.geo?.country || '';
  
  if (country && BLOCKED_COUNTRIES.includes(country)) {
    console.log(`[Middleware] Blocking access from ${country}`);
    return NextResponse.redirect(new URL('/blocked', request.url));
  }
  
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
