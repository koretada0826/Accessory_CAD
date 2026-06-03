import { describe, it, expect } from 'vitest';
import { buildForegroundMask, largestComponent, bestSubjectComponent } from '@/lib/ai/imageContour';

/** W×H の RGBA を作り、塗りコールバックで色を置く */
function makeImage(W: number, H: number, fill: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * W + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return data;
}

describe('imageContour.foreground segmentation', () => {
  const W = 80, H = 100;

  it('暗背景×明るい被写体（四隅にボケ）でも中央の被写体を切り出す', () => {
    const cx = W / 2, cy = H * 0.62; // 中央やや下にペンダント
    const data = makeImage(W, H, (x, y) => {
      // 暗い背景
      let v: [number, number, number] = [18, 16, 12];
      // 隅のボケ（明るい暖色の塊）
      if (Math.hypot(x - (W - 8), y - 10) < 9) v = [220, 180, 120];
      // 中央のゴールド被写体（しずく型に近い楕円）
      if (((x - cx) / 13) ** 2 + ((y - cy) / 18) ** 2 < 1) v = [210, 165, 80];
      return v;
    });

    const { mask } = buildForegroundMask(data, W, H);
    const comp = largestComponent(mask, W, H);
    expect(comp).not.toBeNull();
    // 抽出された成分の重心が画像中央付近（隅のボケではない）
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < W * H; i++) if (comp!.mask[i]) { sx += i % W; sy += (i / W) | 0; n++; }
    const gx = sx / n, gy = sy / n;
    expect(Math.abs(gx - cx)).toBeLessThan(W * 0.25);
    expect(Math.abs(gy - cy)).toBeLessThan(H * 0.25);
    expect(comp!.area).toBeGreaterThan(W * H * 0.015);
  });

  it('チェーン＋ペンダント: 細線ではなく中央の密集塊を選び、内部穴を埋める', () => {
    const W2 = 60, H2 = 100;
    const mask = new Uint8Array(W2 * H2);
    const set = (x: number, y: number) => { if (x >= 0 && x < W2 && y >= 0 && y < H2) mask[y * W2 + x] = 1; };
    // 細いチェーン（縦線・幅1px）上部から中央へ
    for (let y = 5; y < 60; y++) set(W2 / 2, y);
    // 中央下の“枠だけ”ペンダント（中央が空洞のリング状）
    const cx = W2 / 2, cy = 72, R = 12;
    for (let a = 0; a < 360; a += 4) {
      const rad = (a * Math.PI) / 180;
      for (let t = 0; t < 3; t++) set(Math.round(cx + (R - t) * Math.cos(rad)), Math.round(cy + (R - t) * Math.sin(rad)));
    }
    const comp = bestSubjectComponent(mask, W2, H2);
    expect(comp).not.toBeNull();
    // 穴埋め後の面積は元の枠より大きい（中央の空洞が埋まっている）
    let raw = 0, filled = 0;
    for (let i = 0; i < W2 * H2; i++) { raw += comp!.unfilled[i]; filled += comp!.filled[i]; }
    expect(filled).toBeGreaterThan(raw * 1.5);
    // 選ばれた重心が中央下のペンダント付近（上部の細線ではない）
    let sy = 0, n = 0;
    for (let i = 0; i < W2 * H2; i++) if (comp!.filled[i]) { sy += (i / W2) | 0; n++; }
    expect(sy / n).toBeGreaterThan(H2 * 0.5);
  });
});
