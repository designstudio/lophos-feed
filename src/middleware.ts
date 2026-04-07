import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/api/(.*)',
  '/article/(.*)',
  '/politica-de-privacidade(.*)',
  '/termos-de-uso(.*)',
  '/notas-de-versao(.*)',
])
const isOnboarding = createRouteMatcher(['/onboarding(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()

  // Not logged in and trying to access protected route
  if (!userId && !isPublicRoute(req)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Logged in but accessing login page — send to feed
  if (userId && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup')) {
    return NextResponse.redirect(new URL('/feed', req.url))
  }

  // Signed-in users landing on the marketing home go straight to the app
  if (req.nextUrl.pathname === '/' && userId) {
    return NextResponse.redirect(new URL('/feed', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
