import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Atelier — AI Accessory CAD',
  description: '画像・文章・直感操作でアクセサリーを3D設計。誰でもアクセサリー作りを。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="h-screen overflow-hidden antialiased">{children}</body>
    </html>
  );
}
