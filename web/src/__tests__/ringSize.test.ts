import { describe, it, expect } from 'vitest';
import { jpSizeToInnerDiameter, innerDiameterToJpSize, nearestJpSize } from '@/lib/data/ringSize';

describe('ringSize', () => {
  it('号数→内径→号数 がほぼ往復する', () => {
    for (const jp of [1, 7, 13, 20, 30]) {
      const d = jpSizeToInnerDiameter(jp);
      expect(innerDiameterToJpSize(d)).toBeCloseTo(jp, 6);
    }
  });

  it('13号の内径は概ね16.6mm前後', () => {
    const d = jpSizeToInnerDiameter(13);
    expect(d).toBeGreaterThan(16);
    expect(d).toBeLessThan(17.2);
  });

  it('nearestJpSize は最も近い整数号を返す', () => {
    const d = jpSizeToInnerDiameter(17);
    expect(nearestJpSize(d)).toBe(17);
    expect(nearestJpSize(d + 0.01)).toBe(17);
  });
});
