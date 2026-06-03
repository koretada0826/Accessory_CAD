import { describe, it, expect } from 'vitest';
import { detectBail } from '@/lib/ai/imageContour';

/** W×H の空マスクに矩形を塗る小ヘルパ（中心x・幅・y範囲） */
function paintBand(mask: Uint8Array, W: number, cx: number, halfW: number, y0: number, y1: number) {
  for (let y = y0; y < y1; y++) {
    for (let x = Math.round(cx - halfW); x < Math.round(cx + halfW); x++) {
      if (x >= 0 && x < W) mask[y * W + x] = 1;
    }
  }
}

describe('imageContour.detectBail', () => {
  const W = 100;
  const H = 100;

  it('ループ→くびれ→本体 の形を上部バチカンとして検出する', () => {
    const mask = new Uint8Array(W * H);
    // 上部ループ（やや太い輪）
    paintBand(mask, W, 50, 9, 5, 18);
    // くびれ（細い首）
    paintBand(mask, W, 50, 3, 18, 26);
    // 本体（大きい）
    paintBand(mask, W, 50, 30, 26, 90);

    const bail = detectBail(mask, W, H);
    expect(bail).not.toBeNull();
    expect(Math.abs(bail!.cx - 50)).toBeLessThan(6); // 中央付近
    expect(bail!.cy).toBeLessThan(30); // 上部
    expect(bail!.innerDiaPx).toBeGreaterThan(0);
  });

  it('くびれの無い単純な円盤ではバチカンを検出しない', () => {
    const mask = new Uint8Array(W * H);
    paintBand(mask, W, 50, 30, 15, 85);
    expect(detectBail(mask, W, H)).toBeNull();
  });
});
