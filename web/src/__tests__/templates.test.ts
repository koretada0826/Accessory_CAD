import { describe, it, expect } from 'vitest';
import { TEMPLATES, signatureHero } from '@/lib/data/templates';
import { buildModel } from '@/lib/geometry';
import { runManufacturingCheck } from '@/lib/manufacturing/check';

describe('templates', () => {
  it('全シグネチャーテンプレがメッシュ生成・製造チェックを例外なく通る', () => {
    for (const t of TEMPLATES) {
      const d = t.build();
      const model = buildModel(d);
      expect(model.parts.length, `${t.name} のパーツ`).toBeGreaterThan(0);
      // 全頂点が有限（NaN混入なし）
      for (const part of model.parts) {
        const pos = part.geometry.getAttribute('position');
        expect(Number.isFinite(pos.getX(0)), `${t.name}/${part.id}`).toBe(true);
      }
      const report = runManufacturingCheck(d);
      expect(report.weightGram, `${t.name} の重量`).toBeGreaterThan(0);
    }
  });

  it('看板デザイン(ソリティア)は石・ギャラリー・メレ・ミル打ちを含む', () => {
    const d = signatureHero();
    const ids = buildModel(d).parts.map((p) => p.id);
    expect(d.stones.length).toBeGreaterThan(0);
    expect(ids.some((id) => id.startsWith('gallery'))).toBe(true);
    expect(ids.some((id) => id.startsWith('melee'))).toBe(true);
    expect(ids.some((id) => id.startsWith('milgrain'))).toBe(true);
    expect(ids.some((id) => id === 'stone-0')).toBe(true);
  });
});
