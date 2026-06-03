import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ダークテーマ基調 + ゴールド系アクセント（ジュエリーらしさ）
        ink: {
          950: '#0a0a0f',
          900: '#101018',
          850: '#15151f',
          800: '#1b1b27',
          700: '#262633',
          600: '#34343f',
          500: '#4a4a57',
        },
        gold: {
          400: '#f0d488',
          500: '#e6c068',
          600: '#caa24a',
        },
        accent: {
          400: '#8b9dff',
          500: '#6b7dff',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 30px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};

export default config;
