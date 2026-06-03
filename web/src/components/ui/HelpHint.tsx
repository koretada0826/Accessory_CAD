'use client';

/**
 * パネルの見出し横に置く「?」ヘルプチップ。
 * ホバー/フォーカスで一言ヘルプを吹き出し表示（初心者が迷わないための直感ガイド）。
 * 状態管理は不要 — group-hover/focus-within のCSSのみで完結する。
 */
export function HelpHint({ text, side = 'bottom' }: { text: string; side?: 'bottom' | 'left' }) {
  const pos =
    side === 'left'
      ? 'right-full top-1/2 mr-2 -translate-y-1/2'
      : 'left-1/2 top-full mt-1.5 -translate-x-1/2';
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        tabIndex={0}
        aria-label="ヘルプ"
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-ink-600 text-[9px] leading-none text-ink-400 transition-colors hover:border-gold-500 hover:text-gold-400 focus:outline-none focus-visible:border-gold-500 focus-visible:text-gold-400"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-30 ${pos} w-44 rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-[10px] font-normal normal-case leading-relaxed tracking-normal text-ink-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {text}
      </span>
    </span>
  );
}
