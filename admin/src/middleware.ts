import { NextRequest, NextResponse } from 'next/server'

// Route guard — API routes handle their own auth.
// This middleware only handles page redirects.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const session      = req.cookies.get('smdb_session')?.value

  // Public routes
  if (pathname.startsWith('/setup') || pathname.startsWith('/login') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
