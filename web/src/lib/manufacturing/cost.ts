import type { AccessoryDesign } from '@/types/accessory';
import { MATERIALS } from '@/lib/data/materials';

/**
 * 原価の概算（参考値）。地金代だけでなく、石代・鋳造/仕上げ工賃を積み上げ、
 * さらに小売の概算レンジ（原価×マークアップ）まで出す。
 *
 * ※ あくまで提案・見積の"目安"。実勢は素材相場・数量・工房で変動する。
 */
export interface CostLine {
  label: string;
  yen: number;
  note?: string;
}

export interface CostBreakdown {
  lines: CostLine[];
  /** 製造原価合計 */
  totalYen: number;
  /** 小売の概算レンジ */
  retailLowYen: number;
  retailHighYen: number;
}

/** 石1個あたりの参考単価（半貴石/CZ想定の控えめ見積） */
function stonePrice(diameterMm: number): number {
  return Math.round(diameterMm * diameterMm * 120);
}

export function estimateCost(design: AccessoryDesign, weightGram: number): CostBreakdown {
  const mat = MATERIALS[design.materialId];
  const metalYen = Math.round(weightGram * mat.costPerGram);

  const stoneYen = design.stones.reduce((s, st) => s + stonePrice(st.diameter), 0);

  // 工賃: 鋳造/仕上げ基本 + 石留め + 刻印 + 重量比例の仕上げ
  const castingBase = 3000;
  const settingFee = design.stones.length * 1500;
  const engraveFee = design.engraving.length * 1000;
  const finishFee = Math.round(weightGram * 200);
  const laborYen = castingBase + settingFee + engraveFee + finishFee;

  const lines: CostLine[] = [
    { label: '地金代', yen: metalYen, note: `${mat.label} ${weightGram}g` },
  ];
  if (stoneYen > 0) lines.push({ label: '石代(参考)', yen: stoneYen, note: `${design.stones.length}石` });
  lines.push({
    label: '鋳造・仕上げ工賃',
    yen: laborYen,
    note: [
      `鋳造${castingBase}`,
      settingFee ? `石留め${settingFee}` : '',
      engraveFee ? `刻印${engraveFee}` : '',
      `研磨${finishFee}`,
    ].filter(Boolean).join(' / '),
  });

  const totalYen = metalYen + stoneYen + laborYen;
  // 小売: 原価の1.8〜3.0倍が一般的なレンジ
  const retailLowYen = Math.round(totalYen * 1.8);
  const retailHighYen = Math.round(totalYen * 3.0);

  return { lines, totalYen, retailLowYen, retailHighYen };
}

/** 鋳造を見据えた製造メモ（仕様書用） */
export function castingNotes(design: AccessoryDesign, weightGram: number): string[] {
  const notes: string[] = [];
  notes.push('寸法は設計値。鋳造収縮（金属で約1〜2%）と研磨代（片側0.03〜0.1mm）を見込んでください。');
  if (weightGram > 6) notes.push('重量が大きめです。裏抜き（肉盗み）で軽量化・地金コスト削減を検討できます。');
  notes.push('湯口（ゲート）位置は最も太い箇所に。仕上げ研磨で消える面を選定してください。');
  if (design.stones.length > 0) notes.push('石留めは鋳造後。爪/覆輪のバリ取り・石座の当たり確認を。');
  const p = design.params;
  if (p.kind === 'pendant' && p.thickness < 1.2) notes.push('板厚が薄め。鋳巣・反りに注意（厚み1.2mm以上推奨）。');
  if (p.kind === 'ring' && p.bandThickness < 1.3) notes.push('アームが細め。サイズ直し代を考慮し1.3mm以上を推奨。');
  return notes;
}
