import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      colors: {
        bg: {
          primary: '#faf9f7',
          secondary: '#f3f1ee',
          tertiary: '#ebe9e4',
        },
        ink: {
          primary: '#1a1916',
          secondary: '#4a4844',
          tertiary: '#8a8784',
          muted: '#b8b5b0',
        },
        accent: '#1b6ef3',
        border: {
          DEFAULT: 'rgba(26,25,22,0.08)',
          strong: 'rgba(26,25,22,0.15)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
    },
  },
  plugins: [],
}
export default config
