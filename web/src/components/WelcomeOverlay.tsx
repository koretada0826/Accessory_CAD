'use client';

import { useEffect, useState, type ReactNode } from 'react';
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

  const Card = ({ icon, title, desc, onClick, accent }: { icon: ReactNode; title: string; desc: string; onClick: () => void; accent?: boolean }) => (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-2.5 rounded-2xl border p-5 text-center transition-all duration-200 hover:-translate-y-1 ${
        accent ? 'border-gold-500/40 bg-gradient-to-b from-gold-500/10 to-transparent shadow-gold' : 'border-ink-700/70 bg-ink-850/40 hover:border-ink-500'
      }`}
    >
      <span className={accent ? 'text-gold-400' : 'text-ink-300 group-hover:text-white'}>{icon}</span>
      <span className="text-sm font-medium text-white">{title}</span>
      <span className="text-[11px] leading-relaxed text-ink-400">{desc}</span>
    </button>
  );

  const iconSvg = (paths: ReactNode) => (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
      <div className="glass animate-fade-up mx-4 w-full max-w-2xl rounded-3xl border border-ink-700 p-8 shadow-panel">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-sheen shadow-gold">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#0a0b11" strokeWidth="1.5" strokeLinejoin="round"><path d="M6 4 H18 L21 9 L12 20 L3 9 Z" /><path d="M3 9 H21 M12 9 V20" /></svg>
          </span>
          <span className="text-[10px] font-medium uppercase tracking-luxe text-gold-400">Atelier へようこそ</span>
        </div>
        <h2 className="font-display text-3xl font-medium text-white">アクセサリー作りを、誰でも。</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">画像・文章・直感操作で3D設計。難しい知識はいりません。まずは始め方を選びましょう。</p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card
            icon={iconSvg(<path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8z" />)}
            title="おまかせで作る"
            desc="ワンクリックで素敵なデザインを自動生成。そこから調整するのが一番かんたん。"
            accent
            onClick={() => {
              surpriseMe();
              close();
            }}
          />
          <Card icon={iconSvg(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5-5L6 20" /></>)} title="画像から作る" desc="好きなアクセの画像を左の「画像」タブにドロップ。AIが形を読み取ります。" onClick={() => close()} />
          <Card icon={iconSvg(<><circle cx="7" cy="8" r="2.4" /><path d="M11 8h8M5 16h8M17 16a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 0 0-4.8 0" /></>)} title="自分で作る" desc="左の「カテゴリ」から選んで、右のスライダーで自由に。迷ったら『かんたん』モードで。" onClick={() => close()} />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-[11px] text-ink-500">右下のAIチャットに「もっと細く」「石を入れて」と話しかけてもOK</span>
          <button onClick={() => close()} className="rounded-xl bg-gold-sheen px-5 py-2 text-xs font-medium text-ink-950 shadow-gold transition-transform hover:-translate-y-px">
            はじめる →
          </button>
        </div>
      </div>
    </div>
  );
}
