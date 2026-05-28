import { NextResponse, NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';

/**
 Middleware to protect dashboard and account routes.
 *
 * - Protected page routes: `/dashboard/**` and `/account/**`
 * - Protected API routes under the same base paths.
 *
 * Unauthenticated users are redirected to `/login` for page requests.
 * API requests receive a 401 JSON response.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define protected base paths
  const protectedBases = ['/dashboard', '/account'];
  const isProtected = protectedBases.some((base) => pathname.startsWith(base));

  // If not a protected route, continue.
  if (!isProtected) {
    return NextResponse.next();
  }

  // Perform session check using the real auth utility.
  const user = await getUser();

  // If a user object is present, allow the request.
  if (user) {
    return NextResponse.next();
  }

  // Determine if the request targets an API route.
  const isApi = pathname.includes('/api/');

  // Unauthenticated API request → 401 response.
  if (isApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Unauthenticated page request → redirect to login.
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

/**
 * Matcher configuration for Next.js middleware.
 * This ensures the middleware runs only on the intended routes.
 */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/account/:path*',
  ],
};
