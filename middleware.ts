import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BLOCKED_COUNTRIES = ['KP', 'RU', 'IR', 'CH']; // North Korea, Russia, Iran, Switzerland

export function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname === '/favicon.ico' ||
    request.nextUrl.pathname === '/blocked'
  ) {
    return NextResponse.next();
  }

  const country = request.geo?.country || '';
  
  if (country && BLOCKED_COUNTRIES.includes(country)) {
    return NextResponse.redirect(new URL('/blocked', request.url));
  }
  
  return NextResponse.next();
}
