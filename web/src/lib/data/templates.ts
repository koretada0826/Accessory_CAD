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
 * しずく型の正規化輪郭 [-0.5,0.5] を生成（上が尖り・下が丸い）。
 * 左右対称。topTaper=上の尖り / bottomRoundness=下の丸み。
 */
function teardropOutline(topTaper = 0.45, bottomRoundness = 0.78, n = 256): { x: number; y: number }[] {
  // 制御点でしずくを構成: 上頂点(0,1)、下は半径rの円弧、両側はベジェ
  const apex = { x: 0, y: 1 };
  const r = 0.5 * (0.7 + bottomRoundness * 0.3); // 下円の半径
  const by = -1 + r; // 下円の中心y
  const rightBottom = { x: r, y: by };
  // 片側ベジェ(apex→rightBottom)を sample
  const bez = (p0: any, c1: any, c2: any, p1: any, steps: number) => {
    const arr: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      arr.push({
        x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
        y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
      });
    }
    return arr;
  };
  const half = Math.floor(n / 4);
  // 右側ベジェ: 頂点(0,1) → 下円の右端(r, by)。上は尖り、側面はなめらかに膨らむ。
  const c1 = { x: r * (0.55 + topTaper * 0.5), y: 1 - topTaper * 0.85 };
  const c2 = { x: r * 1.04, y: by + r * 0.85 };
  const right = bez(apex, c1, c2, rightBottom, half);
  // 下の円弧: 右端(角0)→最下点(角-π/2=(0,-1))→左端(角-π)。半時計でなく時計回りに。
  const arcN = Math.floor(n / 2);
  const arc: { x: number; y: number }[] = [];
  for (let i = 1; i < arcN; i++) {
    const ang = -(i / arcN) * Math.PI; // 0 → -π
    arc.push({ x: r * Math.cos(ang), y: by + r * Math.sin(ang) });
  }
  // 左側 = 右側ベジェのミラー（leftBottom→apex の順）
  const left = right.map((p) => ({ x: -p.x, y: p.y })).reverse();
  const raw = [...right, ...arc, ...left];
  // bbox 正規化 → [-0.5,0.5]
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of raw) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const w = maxX - minX, h = maxY - minY, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return raw.map((p) => ({ x: (p.x - cx) / w, y: (p.y - cy) / h }));
}

/**
 * 看板級ネックレス＝オープンティアドロップ・ペンダント。
 * 外形しずく − 内側しずく(中抜き) ＋ 下部内側のセンターダイヤ(ベゼル) ＋ 片側パヴェ ＋ チェーン。
 */
export function signatureNecklace(): AccessoryDesign {
  const d = createDesign('necklace', 'オープンティアドロップ ネックレス');
  const W = 14, Hh = 19, fw = 1.7;
  const outline = teardropOutline(0.5, 0.78);
  const sx = 1 - (2 * fw) / W, sy = 1 - (2 * fw) / Hh;
  const inner = outline.map((p) => ({ x: p.x * sx, y: p.y * sy - 0.04 })); // 少し下げてフレーム上側を太く
  if (d.params.kind === 'pendant') {
    d.params.shape = 'custom';
    d.params.outline = outline;
    d.params.innerCutout = inner;
    d.params.width = W;
    d.params.height = Hh;
    d.params.thickness = 1.8;
    d.params.cornerRadius = 0;
    d.params.bail = { type: 'integrated_hole', innerDiameter: 2.4, wall: 1.4 };
    d.params.pave = { side: 'left', count: 18, diameter: 1.0, color: GEM.diamond };
  }
  d.materialId = 'gold_yellow';
  // 下部内側のセンターダイヤ（ベゼル）
  d.stones.push({ id: nanoid(8), cut: 'round', setting: 'bezel', diameter: 3.4, position: { x: 0, y: -Hh * 0.3 }, height: 1.8, color: GEM.diamond });
  d.meta.origin = 'template';
  return d;
}

/**
 * 看板＝最初に表示する華のあるシグネチャー。
 * ホワイトゴールドのソリティア（大粒ダイヤ＋ミル打ち＋ギャラリー＋肩のメレ）。
 */
export function signatureHero(): AccessoryDesign {
  const d = createDesign('stone_ring', 'Solitaire Pavé — ソリティア');
  if (d.params.kind === 'ring') {
    d.params.top = { type: 'stone', width: 6, length: 6, height: 4.4 };
    d.params.bandWidth = 2.6;
    d.params.bandThickness = 1.9;
    d.params.profile = 'comfort';
    d.params.pave = 'shoulder'; // 肩のパヴェ＝“高い”ジュエリーの記号
    d.params.paveColor = GEM.diamond;
  }
  d.materialId = 'gold_white';
  d.stones.push(stone('round', 6, GEM.diamond, 'prong'));
  d.meta.origin = 'template';
  return d;
}

/** スターターテンプレート（シグネチャー優先・欲しくなる順） */
export const TEMPLATES: Template[] = [
  {
    id: 'tpl-open-teardrop',
    name: 'オープンティアドロップ',
    category: 'necklace',
    emoji: '💧',
    build: signatureNecklace,
  },
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
    id: 'tpl-eternity',
    name: 'エタニティ（全周パヴェ）',
    category: 'stone_ring',
    emoji: '💍',
    build: () => {
      const d = createDesign('stone_ring', 'エタニティ');
      if (d.params.kind === 'ring') {
        d.params.top = { type: 'none', width: 6, length: 6, height: 3 };
        d.params.profile = 'flat';
        d.params.bandWidth = 3.2;
        d.params.bandThickness = 1.9;
        d.params.innerDiameter = 17.0;
        d.params.pave = 'full';
        d.params.paveColor = GEM.diamond;
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
