import { create } from 'zustand';
import type { AccessoryDesign, Category, MaterialId } from '@/types/accessory';
import { createDesign } from '@/lib/data/factory';
import { runManufacturingCheck, ManufacturingReport } from '@/lib/manufacturing/check';
import { applyChatEdit } from '@/lib/ai/chatEdit';
import { analyzeImage, AnalyzeResult } from '@/lib/ai/analyzeImage';
import type { Template } from '@/lib/data/templates';
import { randomizeDesign } from '@/lib/data/randomize';

/** UIモード: simple=小学生でも迷わない / pro=数値を全開放 */
export type UiMode = 'simple' | 'pro';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  ts: number;
}

interface DesignState {
  design: AccessoryDesign;
  report: ManufacturingReport;
  selectedComponentId: string | null;
  chat: ChatMessage[];
  busy: boolean;
  lastAnalyze: AnalyzeResult['detected'] | null;
  uiMode: UiMode;

  past: AccessoryDesign[];
  future: AccessoryDesign[];

  // --- 更新の中心。producer内で draft を直接書き換える ---
  commit: (producer: (draft: AccessoryDesign) => void, label?: string) => void;
  /** 履歴に積まない一時更新（ドラッグ中など）。現状はcommitと同等 */
  replaceDesign: (next: AccessoryDesign, pushHistory?: boolean) => void;

  selectComponent: (id: string | null) => void;
  setMaterial: (id: MaterialId) => void;
  /** 石の位置をドラッグ更新（pushHistory=trueの時だけ履歴に積む＝ドラッグ開始時のみ） */
  moveStone: (index: number, x: number, y: number, pushHistory: boolean) => void;

  setUiMode: (mode: UiMode) => void;
  surpriseMe: (category?: Category) => void;

  newProject: (category: Category) => void;
  loadTemplate: (tpl: Template) => void;
  analyzeFromImage: (dataUrl: string) => Promise<void>;
  importDesign: (d: AccessoryDesign) => void;

  sendChat: (text: string) => Promise<void>;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const HISTORY_LIMIT = 50;

function withReport(design: AccessoryDesign): { design: AccessoryDesign; report: ManufacturingReport } {
  const report = runManufacturingCheck(design);
  // 警告は構造JSONにも反映（保存・共有時に残す）
  const next = { ...design, warnings: report.warnings, meta: { ...design.meta, updatedAt: design.meta.updatedAt } };
  return { design: next, report };
}

const initial = createDesign('ring', 'はじめてのリング');

export const useDesignStore = create<DesignState>((set, get) => ({
  ...withReport(initial),
  selectedComponentId: initial.components[0]?.id ?? null,
  chat: [
    {
      id: 'welcome',
      role: 'ai',
      text:
        'こんにちは！アクセサリーCADへようこそ。画像をアップロード、テンプレート選択、または右パネルで数値を調整できます。チャットで「もう少し細く」「石を中央に」「13号にして」など指示もできます。',
      ts: 0,
    },
  ],
  busy: false,
  lastAnalyze: null,
  uiMode: 'simple',
  past: [],
  future: [],

  setUiMode: (mode) => set({ uiMode: mode }),

  surpriseMe: (category) => {
    const d = randomizeDesign(category);
    const { design, report } = withReport(d);
    set({ design, report, selectedComponentId: d.components[0]?.id ?? null, past: [], future: [], lastAnalyze: null });
  },

  commit: (producer, _label) => {
    const { design, past } = get();
    const draft: AccessoryDesign = structuredClone(design);
    producer(draft);
    const { design: next, report } = withReport(draft);
    set({
      design: next,
      report,
      past: [...past.slice(-HISTORY_LIMIT + 1), design],
      future: [],
    });
  },

  replaceDesign: (next, pushHistory = true) => {
    const { design, past } = get();
    const { design: withRep, report } = withReport(next);
    set({
      design: withRep,
      report,
      past: pushHistory ? [...past.slice(-HISTORY_LIMIT + 1), design] : past,
      future: [],
    });
  },

  selectComponent: (id) => set({ selectedComponentId: id }),

  setMaterial: (id) => get().commit((d) => void (d.materialId = id), 'material'),

  moveStone: (index, x, y, pushHistory) => {
    const { design, past } = get();
    if (!design.stones[index]) return;
    const draft: AccessoryDesign = structuredClone(design);
    draft.stones[index].position = { x, y };
    const { design: next, report } = withReport(draft);
    set({
      design: next,
      report,
      past: pushHistory ? [...past.slice(-HISTORY_LIMIT + 1), design] : past,
      future: [],
    });
  },

  newProject: (category) => {
    const d = createDesign(category);
    const { design, report } = withReport(d);
    set({ design, report, selectedComponentId: d.components[0]?.id ?? null, past: [], future: [], lastAnalyze: null });
  },

  loadTemplate: (tpl) => {
    const d = tpl.build();
    const { design, report } = withReport(d);
    set({ design, report, selectedComponentId: d.components[0]?.id ?? null, past: [], future: [], lastAnalyze: null });
  },

  importDesign: (d) => {
    const { design, report } = withReport(d);
    set({ design, report, selectedComponentId: d.components[0]?.id ?? null, past: [], future: [], lastAnalyze: null });
  },

  analyzeFromImage: async (dataUrl) => {
    set({ busy: true });
    try {
      const result = await analyzeImage(dataUrl);
      const { design, report } = withReport(result.design);
      set((s) => ({
        design,
        report,
        selectedComponentId: design.components[0]?.id ?? null,
        past: [],
        future: [],
        lastAnalyze: result.detected,
        chat: [
          ...s.chat,
          {
            id: `ai-${Date.now()}`,
            role: 'ai',
            text: `画像を解析しました（信頼度 ${(result.confidence * 100).toFixed(0)}%）。推定カテゴリ: ${result.detected.estimatedCategory}。${result.detected.features.join(' / ')}。数値やチャットで調整してください。`,
            ts: Date.now(),
          },
        ],
      }));
    } finally {
      set({ busy: false });
    }
  },

  sendChat: async (text) => {
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text, ts: Date.now() };
    set((s) => ({ chat: [...s.chat, userMsg], busy: true }));
    // 体感のための微小ディレイ無しで即時反映（将来はLLM呼び出しに置換）
    const { design } = get();
    const result = applyChatEdit(text, design);
    const { design: next, report } = withReport(result.design);
    set((s) => ({
      design: result.changed ? next : s.design,
      report: result.changed ? report : s.report,
      past: result.changed ? [...s.past.slice(-HISTORY_LIMIT + 1), design] : s.past,
      future: result.changed ? [] : s.future,
      busy: false,
      chat: [...s.chat, { id: `ai-${Date.now()}`, role: 'ai', text: result.reply, ts: Date.now() }],
    }));
  },

  undo: () => {
    const { past, design, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const { design: withRep, report } = withReport(prev);
    set({ design: withRep, report, past: past.slice(0, -1), future: [design, ...future] });
  },

  redo: () => {
    const { future, design, past } = get();
    if (future.length === 0) return;
    const next = future[0];
    const { design: withRep, report } = withReport(next);
    set({ design: withRep, report, past: [...past, design], future: future.slice(1) });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
