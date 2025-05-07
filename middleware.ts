import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BLOCKED_COUNTRIES = ['KP', 'RU', 'IR', 'CH']; // North Korea, Russia, Iran, Switzerland

export function middleware(request: NextRequest) {
  const country = request.geo?.country || '';
  
  if (country && BLOCKED_COUNTRIES.includes(country)) {
    return NextResponse.rewrite(new URL('/blocked', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|blocked).*)'],
};
