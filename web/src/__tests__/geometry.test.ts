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

  it('estimateVolumeMm3 は正の体積を返す', () => {
    for (const c of CATS) {
      expect(estimateVolumeMm3(createDesign(c))).toBeGreaterThan(0);
    }
  });
});
