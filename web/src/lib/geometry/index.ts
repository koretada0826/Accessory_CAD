import type { AccessoryDesign } from '@/types/accessory';
import { BuiltModel } from './primitives';
import { buildRing } from './ring';
import { buildPendant } from './pendant';
import { buildBracelet, buildEarrings, buildGeneric } from './simple';

export type { BuiltModel, BuiltPart } from './primitives';

/**
 * 構造JSON(AccessoryDesign) → mesh(BuiltModel)。
 * params.kind で分岐。新カテゴリはここに1ケース足すだけ。
 *
 * 注意: これはブラウザ表示用の近似メッシュ。製造用の厳密ソリッドは
 *       将来 backend(CadQuery/OCC) で生成し、構造JSONを共有する。
 */
export function buildModel(design: AccessoryDesign): BuiltModel {
  const p = design.params;
  switch (p.kind) {
    case 'ring':
      return buildRing(design, p);
    case 'pendant':
      return buildPendant(design, p);
    case 'earrings':
      return buildEarrings(design, p);
    case 'bracelet':
      return buildBracelet(design, p);
    case 'generic':
    default:
      return buildGeneric(design, p);
  }
}

/** 体積概算(mm^3) — 重量・原価推定に使用（メッシュ非依存のヒューリスティック） */
export function estimateVolumeMm3(design: AccessoryDesign): number {
  const p = design.params;
  switch (p.kind) {
    case 'ring': {
      const centerR = p.innerDiameter / 2 + p.bandThickness / 2;
      const circumference = 2 * Math.PI * centerR;
      let area = p.bandThickness * p.bandWidth; // 断面積
      if (p.profile === 'round') area *= Math.PI / 4;
      if (p.profile === 'knife') area *= 0.5;
      let v = area * circumference;
      if (p.top.type === 'signet') v += p.top.width * p.top.length * p.top.height * 0.85;
      if (p.top.type === 'dome') v += (2 / 3) * Math.PI * Math.pow(p.top.width / 2, 2) * p.top.height;
      return v;
    }
    case 'pendant': {
      // 外形面積の近似（包絡矩形 × 形状係数）× 厚み
      const shapeFactor =
        p.shape === 'disc' || p.shape === 'oval' ? Math.PI / 4 : p.shape === 'heart' ? 0.7 : 0.92;
      let area = p.width * p.height * shapeFactor;
      // 吊り穴ぶんを控除
      if (p.bail.type === 'integrated_hole') area -= Math.PI * Math.pow(p.bail.innerDiameter / 2, 2);
      return Math.max(0, area) * p.thickness;
    }
    case 'earrings': {
      if (p.style === 'hoop') {
        const R = p.hoopDiameter / 2;
        return Math.PI * Math.pow(p.wireDiameter / 2, 2) * (2 * Math.PI * R);
      }
      return p.bodyWidth * p.bodyHeight * p.thickness * 0.9;
    }
    case 'bracelet': {
      let v = p.plateWidth * p.plateLength * p.thickness;
      v += p.linkCount * 2 * (5 * p.plateWidth * 0.7 * p.thickness * 0.8);
      return v;
    }
    default:
      return p.width * p.height * p.thickness;
  }
}
