import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // dark luxury 基調: わずかに青みのある深い黒〜チャコール
        ink: {
          950: '#06070b',
          900: '#0a0b11',
          850: '#0f1018',
          800: '#15171f',
          700: '#20222c', // hairline / border
          600: '#2c2f3a',
          500: '#444a59',
        },
        // 上品なシャンパンゴールド（ネオンにしない・くすませる）
        gold: {
          400: '#ecdcad',
          500: '#d8bd80',
          600: '#b89a55',
        },
        // 控えめなプラチナブルー（差し色・最小限）
        accent: {
          400: '#9fb0d8',
          500: '#7e92c4',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'Hiragino Mincho ProN', 'serif'],
      },
      letterSpacing: {
        luxe: '0.18em',
      },
      boxShadow: {
        // パネルの奥行き: 上部の極薄ハイライト + 落ち影
        panel: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 18px 50px -20px rgba(0,0,0,0.75)',
        // ゴールドの上品な光（控えめ）
        gold: '0 0 0 1px rgba(216,189,128,0.35), 0 6px 22px -8px rgba(216,189,128,0.28)',
      },
      backgroundImage: {
        'gold-sheen': 'linear-gradient(135deg, #ecdcad 0%, #d8bd80 45%, #b89a55 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
