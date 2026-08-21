import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/feed(.*)',
  '/api(.*)',
  '/article(.*)',
  '/lists(.*)',
  '/politica-de-privacidade(.*)',
  '/termos-de-uso(.*)',
  '/notas-de-versao(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Reject ordinary non-GET page requests early, while preserving the
  // App Router protocol used by legitimate Server Actions.
  const isServerAction = req.method === 'POST' && req.headers.has('next-action')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !isServerAction) {
    return new NextResponse('Method Not Allowed', {
      status: 405,
      headers: {
        Allow: 'GET, HEAD, OPTIONS',
      },
    })
  }

  const { userId } = await auth()

  // Not logged in and trying to access protected route
  if (!userId && !isPublicRoute(req)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Logged in users do not need the standalone auth pages.
  if (userId && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/api/:path*'],
}
