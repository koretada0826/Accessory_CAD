import type { Metadata } from 'next';
import { Inter, Cormorant_Garamond } from 'next/font/google';
import './globals.css';

// 本文＝洗練された可変サンセリフ / ブランド・見出し＝上質なディスプレイセリフ
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Atelier — AI Accessory CAD',
  description: '画像・文章・直感操作でアクセサリーを3D設計。誰でもアクセサリー作りを。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="h-screen overflow-hidden antialiased">{children}</body>
    </html>
  );
}
