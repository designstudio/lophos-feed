import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/login(.*)', '/api/(.*)'])
const isOnboarding = createRouteMatcher(['/onboarding(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()

  // Not logged in and trying to access protected route
  if (!userId && !isPublicRoute(req)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Logged in but accessing login page — send to feed
  if (userId && req.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/feed', req.url))
  }

  // Root redirect
  if (req.nextUrl.pathname === '/') {
    return NextResponse.redirect(
      new URL(userId ? '/feed' : '/login', req.url)
    )
  }
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
