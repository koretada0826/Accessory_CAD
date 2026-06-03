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
      className="rounded-md px-2.5 py-1.5 text-sm text-ink-300 hover:bg-ink-800 hover:text-white disabled:opacity-30"
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
    <div className="relative flex items-center justify-between border-b border-ink-700 bg-ink-900/80 px-3 py-2 backdrop-blur">
      {/* ロゴ */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-accent-500 text-sm">💎</div>
        <div className="leading-none">
          <div className="text-sm font-semibold text-white">Atelier</div>
          <div className="text-[9px] tracking-wider text-ink-500">AI ACCESSORY CAD</div>
        </div>
      </div>

      {/* 中央: モード切替 + おまかせ + 編集操作 */}
      <div className="flex items-center gap-2">
        {/* かんたん / プロ モード */}
        <div className="flex rounded-lg bg-ink-850 p-0.5">
          <button
            onClick={() => setUiMode('simple')}
            className={`rounded-md px-3 py-1 text-xs font-medium ${uiMode === 'simple' ? 'bg-gold-500 text-ink-950' : 'text-ink-400 hover:text-white'}`}
            title="初心者向け: 迷わないシンプル表示"
          >
            かんたん
          </button>
          <button
            onClick={() => setUiMode('pro')}
            className={`rounded-md px-3 py-1 text-xs font-medium ${uiMode === 'pro' ? 'bg-gold-500 text-ink-950' : 'text-ink-400 hover:text-white'}`}
            title="上級者向け: すべての数値を編集"
          >
            プロ
          </button>
        </div>

        <button
          onClick={() => surpriseMe()}
          className="rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-1.5 text-xs font-medium text-accent-400 hover:bg-accent-500/20"
          title="ワンクリックで素敵なデザインを生成"
        >
          ✨ おまかせ
        </button>

        <div className="mx-0.5 h-5 w-px bg-ink-700" />
        <IconBtn onClick={undo} disabled={!canUndo} title="元に戻す (⌘Z)">↶</IconBtn>
        <IconBtn onClick={redo} disabled={!canRedo} title="やり直し (⇧⌘Z)">↷</IconBtn>
        <IconBtn onClick={() => importRef.current?.click()} title="JSON読込">📂</IconBtn>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
      </div>

      {/* 右: エクスポート */}
      <div className="relative flex items-center gap-2">
        <button
          onClick={() => exportJSON(design)}
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:border-ink-600"
        >
          保存
        </button>
        <button
          onClick={() => setExportOpen((v) => !v)}
          className="rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 px-3 py-1.5 text-xs font-medium text-ink-950"
        >
          エクスポート ▾
        </button>
        {exportOpen && (
          <div className="absolute right-0 top-10 z-30 w-48 overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-panel">
            {exportItems.map((it) => (
              <button
                key={it.label}
                onClick={() => doExport(it.fn, it.label)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-800"
              >
                <span className="font-medium">{it.label}</span>
                {it.note && <span className="text-[10px] text-ink-500">{it.note}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="absolute left-1/2 top-12 z-40 -translate-x-1/2 rounded-lg bg-ink-800 px-3 py-1.5 text-xs text-white ring-1 ring-ink-700">
          {toast}
        </div>
      )}
    </div>
  );
}
