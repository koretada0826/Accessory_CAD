'use client';

import { useRef, useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { CATEGORY_LABELS } from '@/lib/data/factory';
import { FULLY_IMPLEMENTED, type Category } from '@/types/accessory';
import { TEMPLATES } from '@/lib/data/templates';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { TemplateIcon } from '@/components/ui/TemplateIcon';
import { HelpHint } from '@/components/ui/HelpHint';

const PRIORITY: Category[] = ['pendant', 'ring', 'earrings', 'bracelet'];
const OTHERS: Category[] = ['necklace', 'signet', 'stone_ring', 'band', 'hoop', 'earcuff', 'charm', 'dogtag'];

type Tab = 'category' | 'upload' | 'template';

export default function LeftSidebar() {
  const [tab, setTab] = useState<Tab>('category');
  const design = useDesignStore((s) => s.design);
  const newProject = useDesignStore((s) => s.newProject);
  const loadTemplate = useDesignStore((s) => s.loadTemplate);
  const analyzeFromImage = useDesignStore((s) => s.analyzeFromImage);
  const busy = useDesignStore((s) => s.busy);
  const lastAnalyze = useDesignStore((s) => s.lastAnalyze);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setPreview(url);
      void analyzeFromImage(url);
    };
    reader.readAsDataURL(file);
  };

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 rounded-lg py-1.5 text-[11px] transition-all ${tab === id ? 'bg-ink-800 font-medium text-gold-400 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset]' : 'text-ink-400 hover:text-white'}`}
    >
      {label}
    </button>
  );

  const CatButton = ({ c }: { c: Category }) => {
    const impl = FULLY_IMPLEMENTED.includes(c);
    const active = design.category === c;
    return (
      <button
        onClick={() => newProject(c)}
        className={`group relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all duration-200 ${
          active
            ? 'border-gold-500/40 bg-gradient-to-b from-gold-500/10 to-transparent shadow-gold'
            : 'border-ink-700/70 bg-ink-850/40 hover:-translate-y-0.5 hover:border-ink-600'
        }`}
      >
        <CategoryIcon category={c} className={active ? 'text-gold-400' : 'text-ink-300 group-hover:text-white'} />
        <span className={`text-[10px] leading-tight ${active ? 'text-white' : 'text-ink-300'}`}>{CATEGORY_LABELS[c]}</span>
        {!impl && <span className="absolute right-1.5 top-1.5 rounded-full bg-accent-500/15 px-1.5 text-[8px] text-accent-400">β</span>}
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="hairline-b flex items-center gap-1 p-2.5">
        <TabBtn id="category" label="カテゴリ" />
        <TabBtn id="upload" label="画像" />
        <TabBtn id="template" label="テンプレ" />
        <span className="pl-0.5">
          <HelpHint text="作りたい物の種類を『カテゴリ』から。手元の画像から起こすなら『画像』、完成例から始めるなら『テンプレ』。" />
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5">
        {tab === 'category' && (
          <div className="animate-fade-up">
            <div className="mb-2.5 text-[10px] uppercase tracking-luxe text-ink-500">おすすめ</div>
            <div className="mb-5 grid grid-cols-2 gap-2.5">
              {PRIORITY.map((c) => <CatButton key={c} c={c} />)}
            </div>
            <div className="mb-2.5 text-[10px] uppercase tracking-luxe text-ink-500">その他</div>
            <div className="grid grid-cols-2 gap-2.5">
              {OTHERS.map((c) => <CatButton key={c} c={c} />)}
            </div>
          </div>
        )}

        {tab === 'upload' && (
          <div>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
              }}
              className="group flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-ink-600 bg-ink-850/40 p-7 text-center transition-colors hover:border-gold-500/60 hover:bg-gold-500/5"
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-ink-400 group-hover:text-gold-400">
                <rect x="3" y="4" width="18" height="16" rx="2.5" />
                <circle cx="8.5" cy="9.5" r="1.6" />
                <path d="M21 16l-5-5L6 20" />
              </svg>
              <span className="text-xs text-ink-200">画像をドロップ / クリックで選択</span>
              <span className="text-[10px] text-ink-500">AIが形状・カテゴリ・寸法を推定します</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            {busy && <div className="mt-3 text-center text-xs text-gold-400">輪郭を解析中…</div>}
            {preview && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[10px] text-ink-500">
                  <span>解析元画像</span>
                  {lastAnalyze?.overlayPath && <span className="text-gold-400">AIが読み取った輪郭 ▸</span>}
                </div>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="source" className="w-full rounded-lg ring-1 ring-ink-700" />
                  {lastAnalyze?.overlayPath && lastAnalyze.imgW && lastAnalyze.imgH && (
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox={`0 0 ${lastAnalyze.imgW} ${lastAnalyze.imgH}`}
                      preserveAspectRatio="none"
                    >
                      <path d={lastAnalyze.overlayPath} fill="rgba(230,192,104,0.18)" stroke="#e6c068" strokeWidth={1.5} />
                    </svg>
                  )}
                </div>
              </div>
            )}

            {/* 検出フィーチャ */}
            {lastAnalyze && lastAnalyze.features.length > 0 && (
              <div className="mt-3 space-y-1 rounded-lg border border-ink-700 bg-ink-850/60 p-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">AI解析結果</div>
                {lastAnalyze.features.map((f, i) => (
                  <div key={i} className="flex gap-1.5 text-[11px] text-ink-300">
                    <span className="text-gold-400">•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 rounded-lg bg-ink-800/60 p-2 text-[10px] leading-relaxed text-ink-400">
              💡 背景がはっきりした画像（白背景や透過PNG）ほど輪郭精度が上がります。トレース後も右パネルで幅/高さ/厚みを編集できます。
            </div>
          </div>
        )}

        {tab === 'template' && (
          <div className="animate-fade-up space-y-2">
            <div className="mb-1 text-[10px] uppercase tracking-luxe text-ink-500">シグネチャー</div>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => loadTemplate(t)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-ink-700/70 bg-ink-850/40 p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-500/40 hover:bg-gold-500/5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink-700/70 bg-ink-900/60 text-ink-300 group-hover:text-gold-400">
                  <TemplateIcon id={t.id} category={t.category} className="" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-xs text-white">{t.name}</div>
                  <div className="text-[10px] text-ink-500">{CATEGORY_LABELS[t.category]}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
