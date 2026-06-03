import { describe, it, expect } from 'vitest';
import { TEMPLATES, signatureHero, signatureNecklace } from '@/lib/data/templates';
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

  it('看板デザイン(パヴェ・ソリティア)は中央石・ギャラリー・パヴェ石を含む', () => {
    const d = signatureHero();
    const ids = buildModel(d).parts.map((p) => p.id);
    expect(d.stones.length).toBeGreaterThan(0);
    expect(ids.some((id) => id.startsWith('gallery'))).toBe(true);
    expect(ids.some((id) => id.startsWith('pave-') && !id.includes('rail'))).toBe(true);
    expect(ids.some((id) => id === 'stone-0')).toBe(true);
  });

  it('オープンティアドロップ ネックレスは 中抜きフレーム＋センター石＋パヴェ＋チェーン を構成する', () => {
    const d = signatureNecklace();
    expect(d.category).toBe('necklace');
    if (d.params.kind === 'pendant') {
      expect(d.params.innerCutout?.length ?? 0).toBeGreaterThan(8); // 内抜き輪郭
      expect(d.params.pave?.count ?? 0).toBeGreaterThan(0);
    }
    expect(d.stones.length).toBeGreaterThan(0); // センターダイヤ
    const ids = buildModel(d).parts.map((p) => p.id);
    expect(ids.some((id) => id === 'body')).toBe(true);
    expect(ids.some((id) => id === 'stone-0')).toBe(true);
    expect(ids.some((id) => id.startsWith('pave-') && !id.includes('bead'))).toBe(true);
    expect(ids.some((id) => id.startsWith('chain-'))).toBe(true); // チェーンプレビュー
  });

  it('エタニティ(全周パヴェ)は多数のパヴェ石を含む', () => {
    const t = TEMPLATES.find((x) => x.id === 'tpl-eternity')!;
    const ids = buildModel(t.build()).parts.map((p) => p.id);
    const paveStones = ids.filter((id) => id.startsWith('pave-') && !id.includes('rail'));
    expect(paveStones.length).toBeGreaterThan(10); // 全周に多数
  });
});
