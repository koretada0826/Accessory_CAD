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

// リアルで上質な宝石色（くすませず深く）
const GEM = {
  diamond: '#eef6ff',
  onyx: '#141417',
  emerald: '#0f7a52',
  sapphire: '#1c44b0',
  ruby: '#b01235',
  champagne: '#d9c189',
  pearl: '#f3ece0',
};

const stone = (cut: string, diameter: number, color: string, setting = 'prong') => ({
  id: nanoid(8),
  cut: cut as any,
  setting: setting as any,
  diameter,
  position: { x: 0, y: 0 },
  height: diameter * 0.45,
  color,
});

/**
 * 看板＝最初に表示する華のあるシグネチャー。
 * ホワイトゴールドのソリティア（大粒ダイヤ＋ミル打ち＋ギャラリー＋肩のメレ）。
 */
export function signatureHero(): AccessoryDesign {
  const d = createDesign('stone_ring', 'Solitaire — ソリティア');
  if (d.params.kind === 'ring') {
    d.params.top = { type: 'stone', width: 6, length: 6, height: 4 };
    d.params.bandWidth = 2.3;
    d.params.bandThickness = 1.8;
    d.params.profile = 'comfort';
    d.params.milgrain = true;
  }
  d.materialId = 'gold_white';
  d.stones.push(stone('round', 5.6, GEM.diamond, 'prong'));
  d.meta.origin = 'template';
  return d;
}

/** スターターテンプレート（シグネチャー優先・欲しくなる順） */
export const TEMPLATES: Template[] = [
  {
    id: 'tpl-solitaire',
    name: 'ソリティア（ダイヤ）',
    category: 'stone_ring',
    emoji: '💍',
    build: signatureHero,
  },
  {
    id: 'tpl-mode-signet',
    name: 'モード シグネット',
    category: 'signet',
    emoji: '🛡️',
    build: () => {
      const d = createDesign('signet', 'モード シグネット');
      if (d.params.kind === 'ring') {
        d.params.top = { type: 'signet', width: 12, length: 14, height: 3.2 };
        d.params.bandWidth = 4;
        d.params.bandThickness = 2;
        d.params.profile = 'flat';
      }
      d.materialId = 'gold_yellow';
      d.engraving.push({ id: nanoid(8), text: 'A', size: 7, depth: -0.6, position: { x: 0, y: 0 }, font: 'serif' });
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-onyx-hexa',
    name: 'オニキス ヘキサ',
    category: 'pendant',
    emoji: '⬡',
    build: () => {
      const d = createDesign('pendant', 'オニキス ヘキサ');
      if (d.params.kind === 'pendant') {
        d.params.shape = 'hexagon';
        d.params.width = 18;
        d.params.height = 20;
        d.params.thickness = 2;
        d.params.cornerRadius = 0;
      }
      d.materialId = 'gold_yellow';
      d.stones.push(stone('cabochon', 8, GEM.onyx, 'bezel'));
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-milgrain-band',
    name: 'ミルグレイン バンド',
    category: 'ring',
    emoji: '💍',
    build: () => {
      const d = createDesign('ring', 'ミルグレイン バンド');
      if (d.params.kind === 'ring') {
        d.params.profile = 'flat';
        d.params.bandWidth = 3.6;
        d.params.bandThickness = 1.8;
        d.params.innerDiameter = 17.0;
        d.params.milgrain = true;
      }
      d.materialId = 'platinum';
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-ear-cuff',
    name: 'モダン イヤーカフ',
    category: 'earcuff',
    emoji: '🌙',
    build: () => {
      const d = createDesign('earcuff', 'モダン イヤーカフ');
      d.materialId = 'gold_yellow';
      d.stones.push(stone('round', 3, GEM.champagne, 'bezel'));
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-baguette-drop',
    name: 'バゲット ドロップ',
    category: 'earrings',
    emoji: '💎',
    build: () => {
      const d = createDesign('earrings', 'バゲット ドロップ');
      if (d.params.kind === 'earrings') {
        d.params.style = 'drop';
        d.params.bodyWidth = 7;
        d.params.bodyHeight = 13;
      }
      d.materialId = 'gold_white';
      d.stones.push(stone('emerald', 5, GEM.diamond, 'bezel'));
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-emerald-pendant',
    name: 'エメラルド ペンダント',
    category: 'pendant',
    emoji: '🟢',
    build: () => {
      const d = createDesign('pendant', 'エメラルド ペンダント');
      if (d.params.kind === 'pendant') {
        d.params.shape = 'oval';
        d.params.width = 14;
        d.params.height = 20;
        d.params.thickness = 1.8;
      }
      d.materialId = 'gold_yellow';
      d.stones.push(stone('emerald', 6, GEM.emerald, 'prong'));
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
        d.params.milgrain = true;
      }
      d.materialId = 'platinum';
      d.stones.push(
        stone('round', 4.5, GEM.diamond, 'prong'),
        stone('round', 2.8, GEM.diamond, 'prong'),
        stone('round', 2.8, GEM.diamond, 'prong'),
      );
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-disc-pendant',
    name: 'コイン ペンダント',
    category: 'pendant',
    emoji: '🪙',
    build: () => {
      const d = createDesign('pendant', 'コイン ペンダント');
      if (d.params.kind === 'pendant') {
        d.params.shape = 'disc';
        d.params.width = 20;
        d.params.height = 20;
        d.params.thickness = 2;
      }
      d.materialId = 'gold_yellow';
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-hoop',
    name: 'フープ ピアス',
    category: 'hoop',
    emoji: '⭕',
    build: () => {
      const d = createDesign('hoop', 'フープ ピアス');
      d.materialId = 'gold_yellow';
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-pearl-stud',
    name: 'パール スタッド',
    category: 'earrings',
    emoji: '🫧',
    build: () => {
      const d = createDesign('earrings', 'パール スタッド');
      if (d.params.kind === 'earrings') {
        d.params.style = 'stud';
        d.params.bodyWidth = 6;
        d.params.bodyHeight = 6;
      }
      d.materialId = 'gold_yellow';
      d.stones.push(stone('cabochon', 6, GEM.pearl, 'bezel'));
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
        d.params.thickness = 1.8;
      }
      d.materialId = 'steel';
      d.engraving.push({ id: nanoid(8), text: 'ATELIER', size: 3, depth: -0.4, position: { x: 0, y: 0 }, font: 'sans' });
      d.meta.origin = 'template';
      return d;
    },
  },
  {
    id: 'tpl-signet-onyx',
    name: 'シグネット（オニキス）',
    category: 'signet',
    emoji: '🛡️',
    build: () => {
      const d = createDesign('signet', 'シグネット オニキス');
      if (d.params.kind === 'ring') {
        d.params.top = { type: 'signet', width: 11, length: 13, height: 2.8 };
        d.params.bandWidth = 3.6;
      }
      d.materialId = 'gold_white';
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
