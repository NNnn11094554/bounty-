import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: { 900: '#14101f', 800: '#1d1530', 700: '#2a2140', 600: '#352a52', 500: '#45386a' },
        gold: { DEFAULT: '#ffc93c', soft: '#ffe08a', deep: '#e8a317' },
        coral: { from: '#ff8a3d', to: '#ff5f6d' },
        teal: { DEFAULT: '#2ed3c6', soft: '#7ce9df' },
        lime: { DEFAULT: '#4ade80' },
        violet: { DEFAULT: '#a66bff' },
        line: 'rgba(255,255,255,0.06)',
      },
      fontFamily: {
        sans: ['"Nunito Variable"', 'Nunito', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
      },
      boxShadow: {
        card: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -8px 24px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.25)',
        glow: '0 0 32px rgba(255,201,60,0.35)',
        button: '0 8px 20px rgba(255,95,109,0.35), inset 0 1px 0 rgba(255,255,255,0.35)',
      },
      backgroundImage: {
        app: 'linear-gradient(180deg, #14101f 0%, #1d1530 100%)',
        cta: 'linear-gradient(135deg, #ff8a3d 0%, #ff5f6d 100%)',
        progress: 'linear-gradient(90deg, #2ed3c6 0%, #ff8a3d 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
