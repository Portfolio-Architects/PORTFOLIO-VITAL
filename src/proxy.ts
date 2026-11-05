import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isPublicStaticAsset =
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/templates/') ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|txt|xml)$/i.test(pathname);

  if (isPublicStaticAsset) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get('hchps_session');
  const isAuthenticated = sessionCookie?.value === 'authenticated-secure-session-token';
  const isLoginPage = pathname === '/login';
  const isPublicFestival =
    pathname.startsWith('/festival') ||
    pathname.startsWith('/api/festival') ||
    pathname.startsWith('/memo') ||
    pathname.startsWith('/api/memo') ||
    pathname.startsWith('/api/calendar') ||
    pathname.startsWith('/api/auth');
  const isTunnelDomain = req.nextUrl.hostname.includes('trycloudflare.com') || req.nextUrl.hostname.includes('loca.lt');

  // 외부 터널 도메인으로 루트(/) 접속 시 양재천 페스티벌 관제판으로 자동 이동
  if (isTunnelDomain && pathname === '/') {
    return NextResponse.redirect(new URL('/festival/yangjae', req.url));
  }

  if (isPublicFestival) {
    return NextResponse.next();
  }

  if (!isAuthenticated && !isLoginPage) {
    // Redirect unauthenticated users to the login page
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isAuthenticated && isLoginPage) {
    // Redirect authenticated users away from the login page
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|icon-.*\\.png|.*\\.svg).*)',
  ],
};
