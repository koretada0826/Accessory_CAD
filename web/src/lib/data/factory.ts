import { nanoid } from 'nanoid';
import {
  AccessoryDesign,
  Category,
  CategoryParams,
  Component,
  ManufacturingRules,
  SCHEMA_VERSION,
} from '@/types/accessory';

/** 固定タイムスタンプ生成（SSRハイドレーション差異を避けるため呼び出し側で上書き可） */
function now(): string {
  return new Date().toISOString();
}

/** 標準の製造ルール（貴金属の一般的なしきい値） */
export function defaultManufacturingRules(): ManufacturingRules {
  return {
    minWallThickness: 0.8,
    minHoleDiameter: 1.0,
    minBandThickness: 1.0,
    minConnectorWidth: 0.9,
  };
}

/** カテゴリ別の初期パラメータ */
export function defaultParams(category: Category): CategoryParams {
  switch (category) {
    case 'ring':
    case 'signet':
    case 'band':
    case 'stone_ring':
      return {
        kind: 'ring',
        innerDiameter: 17.0, // ≒13号
        bandWidth: 3.0,
        bandThickness: 1.6,
        profile: 'comfort',
        top: {
          type: category === 'signet' ? 'signet' : category === 'stone_ring' ? 'stone' : 'none',
          width: 10,
          length: 12,
          height: 2.5,
        },
      };
    case 'pendant':
    case 'charm':
    case 'dogtag':
    case 'necklace':
      return {
        kind: 'pendant',
        shape: category === 'dogtag' ? 'tag' : 'disc',
        width: 18,
        height: 18,
        thickness: 1.6,
        cornerRadius: 3,
        bail: { type: 'integrated_hole', innerDiameter: 3, wall: 1.5 },
      };
    case 'earrings':
    case 'hoop':
      return {
        kind: 'earrings',
        style: category === 'hoop' ? 'hoop' : 'stud',
        bodyWidth: 8,
        bodyHeight: 8,
        thickness: 1.4,
        hoopDiameter: 16,
        wireDiameter: 1.0,
      };
    case 'bracelet':
      return {
        kind: 'bracelet',
        style: 'plate',
        plateWidth: 8,
        plateLength: 32,
        thickness: 1.6,
        linkCount: 5,
        innerCircumference: 175,
      };
    case 'earcuff':
    default:
      return { kind: 'generic', width: 16, height: 10, thickness: 1.6 };
  }
}

/** カテゴリ別の論理パーツ一覧 */
export function defaultComponents(category: Category): Component[] {
  const c = (type: Component['type'], label: string): Component => ({
    id: nanoid(8),
    type,
    label,
    visible: true,
  });

  switch (category) {
    case 'ring':
    case 'signet':
    case 'band':
    case 'stone_ring':
      return [c('shank', 'アーム (シャンク)'), c('top', 'トップ'), c('bezel', '石座')];
    case 'pendant':
    case 'charm':
    case 'dogtag':
    case 'necklace':
      return [c('body', '本体'), c('bail', 'バチカン/吊り穴'), c('border', '縁取り')];
    case 'earrings':
    case 'hoop':
      return [c('stud', '本体'), c('hook', 'フック/ポスト'), c('connector', '接続部')];
    case 'bracelet':
      return [c('plate', 'プレート'), c('link', 'リンク'), c('clasp', '留め具')];
    default:
      return [c('body', '本体')];
  }
}

export const CATEGORY_LABELS: Record<Category, string> = {
  pendant: 'ペンダント',
  ring: 'リング',
  earrings: 'ピアス',
  earcuff: 'イヤーカフ',
  bracelet: 'ブレスレット',
  necklace: 'ネックレス',
  charm: 'チャーム',
  dogtag: 'ドッグタグ',
  signet: 'シグネット',
  band: 'バンドリング',
  stone_ring: 'ストーンリング',
  hoop: 'フープピアス',
};

/** 新規 AccessoryDesign を生成 */
export function createDesign(category: Category, name?: string): AccessoryDesign {
  const ts = now();
  return {
    id: nanoid(10),
    name: name ?? `${CATEGORY_LABELS[category]} デザイン`,
    category,
    unit: 'mm',
    meta: { createdAt: ts, updatedAt: ts, origin: 'scratch' },
    params: defaultParams(category),
    components: defaultComponents(category),
    materialId: 'silver',
    stones: [],
    holes: [],
    patterns: [],
    engraving: [],
    symmetry: { mirrorX: true, mirrorY: false },
    manufacturingRules: defaultManufacturingRules(),
    warnings: [],
    schemaVersion: SCHEMA_VERSION,
  };
}
