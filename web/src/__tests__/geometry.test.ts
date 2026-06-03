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

  it('画像レリーフ: relief付きペンダントは隆起メッシュを生成する', () => {
    const d = createDesign('pendant');
    if (d.params.kind === 'pendant') {
      d.params.shape = 'custom';
      d.params.outline = [
        { x: -0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: -0.5 }, { x: -0.5, y: -0.5 },
      ];
      // 4x4 の高さマップ（中央が高い）
      const gx = 4, gy = 4;
      const data: number[] = [];
      for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
        const cx = (i - 1.5) / 1.5, cy = (j - 1.5) / 1.5;
        data.push(Math.max(0, 1 - Math.hypot(cx, cy)));
      }
      d.params.relief = { gx, gy, data, depth: 1.5 };
    }
    const model = buildModel(d);
    const relief = model.parts.find((p) => p.id === 'relief');
    expect(relief).toBeTruthy();
    const pos = relief!.geometry.getAttribute('position');
    expect(pos.count).toBeGreaterThan(0);
    let zmax = -Infinity;
    for (let i = 0; i < pos.count; i++) zmax = Math.max(zmax, pos.getZ(i));
    // 中央が depth ぶん隆起している（前面 thickness/2 より高い）
    expect(zmax).toBeGreaterThan(d.params.kind === 'pendant' ? d.params.thickness / 2 : 0);
  });

  it('ミル打ち: milgrain有効なリングは粒飾りパーツを生成する', () => {
    const d = createDesign('ring');
    if (d.params.kind === 'ring') d.params.milgrain = true;
    const model = buildModel(d);
    const mil = model.parts.filter((p) => p.id.startsWith('milgrain'));
    expect(mil.length).toBeGreaterThan(0);
    const pos = mil[0].geometry.getAttribute('position');
    expect(Number.isFinite(pos.getX(0))).toBe(true);
  });

  it('リング各断面のバンドは外向き巻き（符号付き体積>0＝裏返り無し）', () => {
    // 符号付き体積: 三角形 (v0,v1,v2) の dot(v0, v1×v2)/6 の総和。
    // 外向きCCW巻きなら正、内向き(裏返り=暗くなる)なら負。
    const signedVolume = (geo: any): number => {
      const pos = geo.getAttribute('position');
      const idx = geo.index;
      const count = idx ? idx.count : pos.count;
      const gi = (i: number) => (idx ? idx.getX(i) : i);
      let vol = 0;
      for (let i = 0; i < count; i += 3) {
        const a = gi(i), b = gi(i + 1), c = gi(i + 2);
        const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
        const bx = pos.getX(b), by = pos.getY(b), bz = pos.getZ(b);
        const cx = pos.getX(c), cy = pos.getY(c), cz = pos.getZ(c);
        // dot(a, b×c)
        vol += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
      }
      return vol / 6;
    };
    for (const prof of ['flat', 'comfort', 'round', 'knife'] as const) {
      const d = createDesign('ring');
      if (d.params.kind === 'ring') d.params.profile = prof;
      const model = buildModel(d);
      const shank = model.parts.find((p) => p.id === 'shank')!;
      expect(signedVolume(shank.geometry), `profile=${prof} の巻きが反転`).toBeGreaterThan(0);
    }
  });

  it('estimateVolumeMm3 は正の体積を返す', () => {
    for (const c of CATS) {
      expect(estimateVolumeMm3(createDesign(c))).toBeGreaterThan(0);
    }
  });
});
