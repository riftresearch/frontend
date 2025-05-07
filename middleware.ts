import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BLOCKED_COUNTRIES = ['KP', 'RU', 'IR', 'CH']; // North Korea, Russia, Iran, Switzerland

export async function middleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.ip || '';
  
  const country = request.geo?.country || '';
  
  if (BLOCKED_COUNTRIES.includes(country)) {
    return NextResponse.rewrite(new URL('/blocked', request.url));
  }
  
  if (!country && ip) {
    try {
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      const data = await response.json();
      
      if (data.country_code && BLOCKED_COUNTRIES.includes(data.country_code)) {
        return NextResponse.rewrite(new URL('/blocked', request.url));
      }
    } catch (error) {
      console.error('Error in geo lookup:', error);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|blocked).*)'],
};
