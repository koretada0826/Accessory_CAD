import { describe, it, expect } from 'vitest';
import { runManufacturingCheck } from '@/lib/manufacturing/check';
import { estimateCost } from '@/lib/manufacturing/cost';
import { createDesign } from '@/lib/data/factory';

describe('manufacturing.check', () => {
  it('標準リングは重量>0・原価>0・水密判定を返す', () => {
    const r = runManufacturingCheck(createDesign('ring'));
    expect(r.weightGram).toBeGreaterThan(0);
    expect(r.costYen).toBeGreaterThan(0);
    expect(r.meshHealth.solids).toBeGreaterThan(0);
    expect(typeof r.meshHealth.allManifold).toBe('boolean');
  });

  it('極薄バンドは error 警告 & printable=false', () => {
    const d = createDesign('ring');
    if (d.params.kind === 'ring') d.params.bandThickness = 0.5;
    const r = runManufacturingCheck(d);
    expect(r.warnings.some((w) => w.severity === 'error')).toBe(true);
    expect(r.printable).toBe(false);
  });
});

describe('manufacturing.cost', () => {
  it('合計は地金代以上で、小売レンジは low<high', () => {
    const d = createDesign('pendant');
    const c = estimateCost(d, 5);
    const metal = c.lines.find((l) => l.label === '地金代')!.yen;
    expect(c.totalYen).toBeGreaterThanOrEqual(metal);
    expect(c.retailLowYen).toBeLessThan(c.retailHighYen);
    expect(c.retailLowYen).toBeGreaterThan(c.totalYen);
  });
});
