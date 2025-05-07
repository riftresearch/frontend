import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import geoip from 'geoip-lite';

const BLOCKED_COUNTRIES = ['KP', 'RU', 'IR', 'CH']; // North Korea, Russia, Iran, Switzerland

export function middleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.ip || '';
  
  try {
    const geo = geoip.lookup(ip);
    
    if (geo && BLOCKED_COUNTRIES.includes(geo.country)) {
      return NextResponse.rewrite(new URL('/blocked', request.url));
    }
  } catch (error) {
    console.error('Error in geo lookup:', error);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|blocked).*)'],
};
