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
      className={`flex-1 rounded-md py-1.5 text-[11px] font-medium ${tab === id ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-white'}`}
    >
      {label}
    </button>
  );

  const CatButton = ({ c }: { c: Category }) => {
    const impl = FULLY_IMPLEMENTED.includes(c);
    return (
      <button
        onClick={() => newProject(c)}
        className={`group relative flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all ${
          design.category === c ? 'border-gold-500 bg-ink-800' : 'border-ink-700 bg-ink-850 hover:border-ink-600'
        }`}
      >
        <CategoryIcon category={c} className={design.category === c ? 'text-gold-400' : 'text-ink-300'} />
        <span className="text-[10px] leading-tight text-ink-200">{CATEGORY_LABELS[c]}</span>
        {!impl && <span className="absolute right-1 top-1 rounded bg-accent-500/20 px-1 text-[8px] text-accent-400">β</span>}
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-ink-700 p-2">
        <TabBtn id="category" label="カテゴリ" />
        <TabBtn id="upload" label="画像" />
        <TabBtn id="template" label="テンプレ" />
        <span className="pl-0.5">
          <HelpHint text="作りたい物の種類を『カテゴリ』から。手元の画像から起こすなら『画像』、完成例から始めるなら『テンプレ』。" />
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'category' && (
          <>
            <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">優先実装</div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {PRIORITY.map((c) => <CatButton key={c} c={c} />)}
            </div>
            <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">その他 (β)</div>
            <div className="grid grid-cols-2 gap-2">
              {OTHERS.map((c) => <CatButton key={c} c={c} />)}
            </div>
          </>
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
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-600 bg-ink-850 p-6 text-center hover:border-gold-500"
            >
              <span className="text-2xl">🖼️</span>
              <span className="text-xs text-ink-300">画像をドロップ / クリックで選択</span>
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
          <div className="space-y-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => loadTemplate(t)}
                className="flex w-full items-center gap-3 rounded-xl border border-ink-700 bg-ink-850 p-2.5 text-left hover:border-gold-500"
              >
                <TemplateIcon id={t.id} category={t.category} className="shrink-0 text-ink-200" />
                <div>
                  <div className="text-xs text-white">{t.name}</div>
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
