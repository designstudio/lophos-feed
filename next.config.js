/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.lophos.space',
          },
        ],
        destination: 'https://lophos.space/:path*',
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  env: {
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/login',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/login',
    NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL: '/feed',
    NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL: '/onboarding',
  },
}
module.exports = nextConfig
