'use client';

import { useRef, useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { exportGLB, exportOBJ, exportSTL, exportSVG, exportJSON, exportSTEP, exportPNG } from '@/lib/export/exporters';
import { exportSpecSheet } from '@/lib/export/specSheet';
import type { AccessoryDesign } from '@/types/accessory';

export default function TopBar() {
  const design = useDesignStore((s) => s.design);
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  const canUndo = useDesignStore((s) => s.canUndo());
  const canRedo = useDesignStore((s) => s.canRedo());
  const importDesign = useDesignStore((s) => s.importDesign);
  const uiMode = useDesignStore((s) => s.uiMode);
  const setUiMode = useDesignStore((s) => s.setUiMode);
  const surpriseMe = useDesignStore((s) => s.surpriseMe);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const doExport = async (fn: () => void | Promise<void>, label: string) => {
    setExportOpen(false);
    try {
      await fn();
      notify(`${label} を書き出しました`);
    } catch (e) {
      notify(`${label} 失敗: ${(e as Error).message}`);
    }
  };

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result as string) as AccessoryDesign;
        importDesign(d);
        notify('プロジェクトを読み込みました');
      } catch {
        notify('JSONの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
  };

  const IconBtn = ({ onClick, disabled, children, title }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-25"
    >
      {children}
    </button>
  );

  const exportItems: { label: string; fn: () => void | Promise<void>; note?: string }[] = [
    { label: '技術仕様書 (PDF用)', fn: () => exportSpecSheet(design), note: '工場提案' },
    { label: '画像保存 (PNG)', fn: () => exportPNG(design), note: '共有用' },
    { label: 'STL', fn: () => exportSTL(design), note: '3Dプリント' },
    { label: 'GLB', fn: () => exportGLB(design), note: 'Web/AR' },
    { label: 'OBJ', fn: () => exportOBJ(design) },
    { label: 'SVG', fn: () => exportSVG(design), note: '2D外形' },
    { label: 'JSON', fn: () => exportJSON(design), note: '構造データ' },
    { label: 'STEP', fn: () => exportSTEP(design), note: 'backend必要' },
  ];

  return (
    <div className="hairline-b glass relative z-20 flex items-center justify-between px-4 py-2.5">
      {/* ブランド */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-sheen shadow-gold">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#0a0b11" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M6 4 H18 L21 9 L12 20 L3 9 Z" />
            <path d="M3 9 H21 M9 4 L7.5 9 M15 4 L16.5 9 M12 9 V20" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="font-display text-[17px] font-medium tracking-wide text-gold-foil">Atelier</div>
          <div className="text-[8px] uppercase tracking-luxe text-ink-500">AI Accessory CAD</div>
        </div>
      </div>

      {/* 中央: モード切替 + おまかせ + 編集操作 */}
      <div className="flex items-center gap-2.5">
        {/* かんたん / プロ モード */}
        <div className="flex rounded-xl border border-ink-700/60 bg-ink-950/50 p-0.5">
          <button
            onClick={() => setUiMode('simple')}
            className={`rounded-lg px-3.5 py-1 text-xs transition-all ${uiMode === 'simple' ? 'bg-ink-800 font-medium text-gold-400 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset]' : 'text-ink-400 hover:text-white'}`}
            title="初心者向け: 迷わないシンプル表示"
          >
            かんたん
          </button>
          <button
            onClick={() => setUiMode('pro')}
            className={`rounded-lg px-3.5 py-1 text-xs transition-all ${uiMode === 'pro' ? 'bg-ink-800 font-medium text-gold-400 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset]' : 'text-ink-400 hover:text-white'}`}
            title="上級者向け: すべての数値を編集"
          >
            プロ
          </button>
        </div>

        <button
          onClick={() => surpriseMe()}
          className="group flex items-center gap-1.5 rounded-xl border border-gold-500/25 bg-gold-500/5 px-3.5 py-1.5 text-xs font-medium text-gold-400 transition-all hover:border-gold-500/50 hover:bg-gold-500/10"
          title="ワンクリックで素敵なデザインを生成"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8z" /></svg>
          おまかせ
        </button>

        <div className="mx-0.5 h-5 w-px bg-white/10" />
        <IconBtn onClick={undo} disabled={!canUndo} title="元に戻す (⌘Z)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1" /></svg>
        </IconBtn>
        <IconBtn onClick={redo} disabled={!canRedo} title="やり直し (⇧⌘Z)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h1" /></svg>
        </IconBtn>
        <IconBtn onClick={() => importRef.current?.click()} title="JSON読込">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
        </IconBtn>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
      </div>

      {/* 右: エクスポート */}
      <div className="relative flex items-center gap-2">
        <button
          onClick={() => exportJSON(design)}
          className="rounded-xl border border-ink-700 px-3.5 py-1.5 text-xs text-ink-200 transition-colors hover:border-ink-600 hover:text-white"
        >
          保存
        </button>
        <button
          onClick={() => setExportOpen((v) => !v)}
          className="rounded-xl bg-gold-sheen px-3.5 py-1.5 text-xs font-medium text-ink-950 shadow-gold transition-transform hover:-translate-y-px"
        >
          エクスポート ▾
        </button>
        {exportOpen && (
          <div className="glass animate-fade-up absolute right-0 top-11 z-30 w-52 overflow-hidden rounded-2xl border border-ink-700 shadow-panel">
            {exportItems.map((it) => (
              <button
                key={it.label}
                onClick={() => doExport(it.fn, it.label)}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs text-ink-200 transition-colors hover:bg-white/5 hover:text-white"
              >
                <span className="font-medium">{it.label}</span>
                {it.note && <span className="text-[10px] text-ink-500">{it.note}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="glass animate-fade-up absolute left-1/2 top-14 z-40 -translate-x-1/2 rounded-xl border border-ink-700 px-3.5 py-2 text-xs text-white shadow-panel">
          {toast}
        </div>
      )}
    </div>
  );
}
