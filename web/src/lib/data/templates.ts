import { nanoid } from 'nanoid';
import { AccessoryDesign, Category } from '@/types/accessory';
import { createDesign, CATEGORY_LABELS } from './factory';

export interface Template {
  id: string;
  name: string;
  category: Category;
  emoji: string;
  build: () => AccessoryDesign;
}

/** スターターテンプレート（プリセット） */
export const TEMPLATES: Template[] = [
  {
    id: 'tpl-disc-pendant',
    name: 'コインペンダント',
    category: 'pendant',
    emoji: '🪙',
    build: () => {
      const d = createDesign('pendant', 'コインペンダント');
      if (d.params.kind === 'pendant') {
        d.params.shape = 'disc';
        d.params.width = 20;
        d.params.height = 20;
        d.params.thickness = 1.8;
      }
      d.materialId = 'gold_yellow';
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-tag-pendant',
    name: 'ドッグタグ',
    category: 'dogtag',
    emoji: '🏷️',
    build: () => {
      const d = createDesign('dogtag', 'ドッグタグ');
      if (d.params.kind === 'pendant') {
        d.params.shape = 'tag';
        d.params.width = 16;
        d.params.height = 28;
        d.params.thickness = 1.6;
      }
      d.engraving.push({
        id: nanoid(8),
        text: 'LOVE',
        size: 4,
        depth: -0.4,
        position: { x: 0, y: 0 },
        font: 'serif',
      });
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-comfort-band',
    name: '甲丸バンドリング',
    category: 'ring',
    emoji: '💍',
    build: () => {
      const d = createDesign('ring', '甲丸バンドリング');
      if (d.params.kind === 'ring') {
        d.params.profile = 'comfort';
        d.params.bandWidth = 3.5;
        d.params.bandThickness = 1.8;
        d.params.innerDiameter = 17.0;
      }
      d.materialId = 'platinum';
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-signet',
    name: 'シグネットリング',
    category: 'signet',
    emoji: '🛡️',
    build: () => {
      const d = createDesign('signet', 'シグネットリング');
      if (d.params.kind === 'ring') {
        d.params.top = { type: 'signet', width: 11, length: 13, height: 2.6 };
        d.params.bandWidth = 3;
      }
      d.materialId = 'gold_yellow';
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-stone-ring',
    name: '一粒ストーンリング',
    category: 'stone_ring',
    emoji: '✨',
    build: () => {
      const d = createDesign('stone_ring', '一粒ストーンリング');
      if (d.params.kind === 'ring') {
        d.params.top = { type: 'stone', width: 6, length: 6, height: 3 };
        d.params.bandWidth = 2.2;
      }
      d.stones.push({
        id: nanoid(8),
        cut: 'round',
        setting: 'prong',
        diameter: 4,
        position: { x: 0, y: 0 },
        height: 2.2,
        color: '#bfe9ff',
      });
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-hoop',
    name: 'フープピアス',
    category: 'hoop',
    emoji: '⭕',
    build: () => {
      const d = createDesign('hoop', 'フープピアス');
      d.materialId = 'gold_yellow';
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-plate-bracelet',
    name: 'プレートブレスレット',
    category: 'bracelet',
    emoji: '🔗',
    build: () => {
      const d = createDesign('bracelet', 'プレートブレスレット');
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-heart-ruby',
    name: 'ハート×ルビー',
    category: 'pendant',
    emoji: '❤️',
    build: () => {
      const d = createDesign('pendant', 'ハートペンダント');
      if (d.params.kind === 'pendant') {
        d.params.shape = 'heart';
        d.params.width = 20;
        d.params.height = 19;
      }
      d.materialId = 'gold_yellow';
      d.stones.push({ id: nanoid(8), cut: 'round', setting: 'bezel', diameter: 4, position: { x: 0, y: -1 }, height: 2, color: '#e0234e' });
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-initial-tag',
    name: 'イニシャル刻印',
    category: 'pendant',
    emoji: '🔤',
    build: () => {
      const d = createDesign('pendant', 'イニシャルペンダント');
      if (d.params.kind === 'pendant') {
        d.params.shape = 'disc';
        d.params.width = 16;
        d.params.height = 16;
      }
      d.materialId = 'gold_white';
      d.engraving.push({ id: nanoid(8), text: 'A', size: 8, depth: -0.5, position: { x: 0, y: 0 }, font: 'serif' });
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-hook-diamond',
    name: '一粒フックピアス',
    category: 'earrings',
    emoji: '💎',
    build: () => {
      const d = createDesign('earrings', 'フックピアス');
      if (d.params.kind === 'earrings') {
        d.params.style = 'hook';
        d.params.bodyWidth = 7;
        d.params.bodyHeight = 7;
      }
      d.materialId = 'platinum';
      d.stones.push({ id: nanoid(8), cut: 'round', setting: 'bezel', diameter: 4, position: { x: 0, y: 0 }, height: 2, color: '#eaf6ff' });
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-pearl-stud',
    name: 'パールスタッド',
    category: 'earrings',
    emoji: '🫧',
    build: () => {
      const d = createDesign('earrings', 'パールスタッド');
      if (d.params.kind === 'earrings') {
        d.params.style = 'stud';
        d.params.bodyWidth = 6;
        d.params.bodyHeight = 6;
      }
      d.materialId = 'gold_yellow';
      d.stones.push({ id: nanoid(8), cut: 'cabochon', setting: 'bezel', diameter: 5, position: { x: 0, y: 0 }, height: 2.5, color: '#f3eee4' });
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-drop-earring',
    name: 'ドロップピアス',
    category: 'earrings',
    emoji: '💧',
    build: () => {
      const d = createDesign('earrings', 'ドロップピアス');
      if (d.params.kind === 'earrings') {
        d.params.style = 'drop';
        d.params.bodyWidth = 8;
        d.params.bodyHeight = 12;
      }
      d.materialId = 'gold_rose';
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-three-stone',
    name: '三石リング',
    category: 'stone_ring',
    emoji: '🔱',
    build: () => {
      const d = createDesign('stone_ring', '三石リング');
      if (d.params.kind === 'ring') {
        d.params.top = { type: 'stone', width: 8, length: 6, height: 3 };
        d.params.bandWidth = 2.4;
      }
      d.materialId = 'platinum';
      d.stones.push(
        { id: nanoid(8), cut: 'round', setting: 'prong', diameter: 4, position: { x: 0, y: 0 }, height: 2, color: '#bfe9ff' },
        { id: nanoid(8), cut: 'round', setting: 'prong', diameter: 2.5, position: { x: 0, y: 0 }, height: 1.4, color: '#eaf6ff' },
        { id: nanoid(8), cut: 'round', setting: 'prong', diameter: 2.5, position: { x: 0, y: 0 }, height: 1.4, color: '#eaf6ff' },
      );
      d.meta.origin = 'template';
      return d;
    },
  },
];

export function templatesByCategory(): Record<string, Template[]> {
  const out: Record<string, Template[]> = {};
  for (const t of TEMPLATES) {
    const key = CATEGORY_LABELS[t.category];
    (out[key] ||= []).push(t);
  }
  return out;
}
