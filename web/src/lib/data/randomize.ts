import { nanoid } from 'nanoid';
import type { AccessoryDesign, Category, MaterialId, StoneCut } from '@/types/accessory';
import { createDesign } from './factory';

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (lo: number, hi: number, step = 0.1) => Math.round((lo + Math.random() * (hi - lo)) / step) * step;

const MATERIALS: MaterialId[] = ['gold_yellow', 'gold_white', 'gold_rose', 'silver', 'platinum'];
const STONE_COLORS = ['#bfe9ff', '#ffd1e8', '#c7ffd8', '#fff3b0', '#e0c3ff', '#ffffff'];
const CUTS: StoneCut[] = ['round', 'oval', 'princess', 'pear', 'marquise', 'cabochon'];

/**
 * 「おまかせデザイン」: 見栄えのする完成形をワンクリック生成する。
 * 初心者が白紙から悩まないための入口（ノーコード体験の核）。
 */
export function randomizeDesign(category?: Category): AccessoryDesign {
  const cat = category ?? pick<Category>(['ring', 'pendant', 'pendant', 'ring']); // 優先カテゴリ多め
  const d = createDesign(cat, 'おまかせデザイン');
  d.materialId = pick(MATERIALS);
  d.meta.origin = 'ai';

  if (d.params.kind === 'ring') {
    d.params.innerDiameter = rand(15.5, 19, 0.05);
    d.params.bandWidth = rand(2, 5, 0.1);
    d.params.bandThickness = rand(1.3, 2.2, 0.1);
    d.params.profile = pick(['flat', 'comfort', 'round', 'knife']);
    const topType = pick(['none', 'none', 'signet', 'stone', 'dome'] as const);
    d.params.top.type = topType;
    if (topType === 'stone') {
      d.stones.push(makeStone(rand(3, 5, 0.1)));
      d.params.top = { type: 'stone', width: 6, length: 6, height: 3 };
    }
  } else if (d.params.kind === 'pendant') {
    d.params.shape = pick(['disc', 'oval', 'heart', 'shield', 'hexagon', 'tag']);
    d.params.width = rand(14, 26, 0.5);
    d.params.height = rand(14, 30, 0.5);
    d.params.thickness = rand(1.2, 2.2, 0.1);
    if (Math.random() < 0.5) d.stones.push({ ...makeStone(rand(2.5, 4, 0.1)), setting: 'bezel' });
  }

  if (Math.random() < 0.4) {
    d.patterns = [{ id: nanoid(6), type: pick(['hammered', 'brushed', 'gothic']), intensity: rand(0.5, 0.9, 0.1) }];
  }
  return d;
}

function makeStone(diameter: number) {
  return {
    id: nanoid(8),
    cut: pick(CUTS),
    setting: 'prong' as const,
    diameter,
    position: { x: 0, y: 0 },
    height: diameter * 0.5,
    color: pick(STONE_COLORS),
  };
}
