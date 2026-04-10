/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  env: {
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/login',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/login',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: '/feed',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: '/onboarding',
  },
}
module.exports = nextConfig
