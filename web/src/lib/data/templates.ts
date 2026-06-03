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
];

export function templatesByCategory(): Record<string, Template[]> {
  const out: Record<string, Template[]> = {};
  for (const t of TEMPLATES) {
    const key = CATEGORY_LABELS[t.category];
    (out[key] ||= []).push(t);
  }
  return out;
}
