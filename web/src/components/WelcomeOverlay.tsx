'use client';

import { useEffect, useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';

const KEY = 'atelier:welcomed:v1';

/**
 * 初回訪問時に表示するガイド。「3つの始め方」を大きく提示して、
 * 初心者が"とりあえず触れる"状態を作る（ノーコード体験の入口）。
 */
export default function WelcomeOverlay() {
  const [open, setOpen] = useState(false);
  const surpriseMe = useDesignStore((s) => s.surpriseMe);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const close = (remember = true) => {
    if (remember) {
      try {
        localStorage.setItem(KEY, '1');
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
  };

  if (!open) return null;

  const Card = ({ emoji, title, desc, onClick, accent }: { emoji: string; title: string; desc: string; onClick: () => void; accent?: boolean }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl border p-5 text-center transition-all hover:-translate-y-0.5 ${
        accent ? 'border-gold-500 bg-gradient-to-b from-gold-500/15 to-transparent' : 'border-ink-700 bg-ink-850 hover:border-ink-500'
      }`}
    >
      <span className="text-3xl">{emoji}</span>
      <span className="text-sm font-semibold text-white">{title}</span>
      <span className="text-[11px] leading-relaxed text-ink-400">{desc}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl rounded-3xl border border-ink-700 bg-ink-900 p-7 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-accent-500 text-lg">💎</span>
          <span className="text-[11px] font-bold tracking-widest text-gold-400">ATELIER へようこそ</span>
        </div>
        <h2 className="text-xl font-bold text-white">アクセサリー作りを、誰でも。</h2>
        <p className="mt-1 text-sm text-ink-400">画像・文章・直感操作で3D設計。難しい知識はいりません。まずは始め方を選びましょう。</p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card
            emoji="✨"
            title="おまかせで作る"
            desc="ワンクリックで素敵なデザインを自動生成。そこから調整するのが一番かんたん。"
            accent
            onClick={() => {
              surpriseMe();
              close();
            }}
          />
          <Card emoji="🖼️" title="画像から作る" desc="好きなアクセの画像を左の「画像」タブにドロップ。AIが形を読み取ります。" onClick={() => close()} />
          <Card emoji="🎛️" title="自分で作る" desc="左の「カテゴリ」から選んで、右のスライダーで自由に。迷ったら『かんたん』モードで。" onClick={() => close()} />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-[11px] text-ink-500">右下のAIチャットに「もっと細く」「石を入れて」と話しかけてもOK</span>
          <button onClick={() => close()} className="rounded-lg px-4 py-2 text-xs text-ink-300 hover:text-white">
            はじめる →
          </button>
        </div>
      </div>
    </div>
  );
}
