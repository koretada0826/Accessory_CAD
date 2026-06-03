import { describe, it, expect } from 'vitest';
import { buildModel, estimateVolumeMm3 } from '@/lib/geometry';
import { createDesign } from '@/lib/data/factory';
import type { Category } from '@/types/accessory';

const CATS: Category[] = ['ring', 'pendant', 'earrings', 'bracelet', 'earcuff'];

describe('geometry.buildModel', () => {
  it('各カテゴリでメッシュ生成が例外を投げない & パーツを返す', () => {
    for (const c of CATS) {
      const d = createDesign(c);
      const model = buildModel(d);
      expect(model.parts.length).toBeGreaterThan(0);
      expect(model.bounds.width).toBeGreaterThan(0);
      // position 属性が有限値（NaN混入なし）
      for (const part of model.parts) {
        const pos = part.geometry.getAttribute('position');
        expect(pos).toBeTruthy();
        expect(Number.isFinite(pos.getX(0))).toBe(true);
      }
    }
  });

  it('カスタム外形ペンダント（画像トレース相当）も生成できる', () => {
    const d = createDesign('pendant');
    if (d.params.kind === 'pendant') {
      d.params.shape = 'custom';
      d.params.outline = [
        { x: -0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: -0.5 }, { x: -0.5, y: -0.5 },
      ];
    }
    const model = buildModel(d);
    expect(model.parts.length).toBeGreaterThan(0);
  });

  it('ストーンリングはギャラリー＋メレ留めを生成する（座標は有限）', () => {
    const d = createDesign('stone_ring');
    const model = buildModel(d);
    const ids = model.parts.map((p) => p.id);
    expect(ids.some((id) => id.startsWith('gallery'))).toBe(true);
    expect(ids.some((id) => id.startsWith('melee'))).toBe(true);
    for (const part of model.parts) {
      const pos = part.geometry.getAttribute('position');
      for (let i = 0; i < Math.min(pos.count, 30); i++) {
        expect(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i))).toBe(true);
      }
    }
  });

  it('estimateVolumeMm3 は正の体積を返す', () => {
    for (const c of CATS) {
      expect(estimateVolumeMm3(createDesign(c))).toBeGreaterThan(0);
    }
  });
});
