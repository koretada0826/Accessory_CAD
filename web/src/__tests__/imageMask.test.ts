import { describe, it, expect } from 'vitest';
import { buildForegroundMask, largestComponent } from '@/lib/ai/imageContour';

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
});
