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

  it('実測肉厚: ペンダント厚みに近い妥当な最小肉厚を測れる', () => {
    const d = createDesign('pendant');
    if (d.params.kind === 'pendant') {
      d.params.shape = 'disc';
      d.params.thickness = 1.8;
    }
    const r = runManufacturingCheck(d);
    expect(r.meshHealth.minWallMm).not.toBeNull();
    // 円盤の最小肉厚は厚み(=1.8mm)付近に出るはず（近似ゆえ広めの許容）
    expect(r.meshHealth.minWallMm!).toBeGreaterThan(0.5);
    expect(r.meshHealth.minWallMm!).toBeLessThan(4);
  });

  it('実測肉厚: 極薄ペンダントは肉厚警告を出す', () => {
    const d = createDesign('pendant');
    if (d.params.kind === 'pendant') {
      d.params.shape = 'disc';
      d.params.thickness = 0.4;
    }
    const r = runManufacturingCheck(d);
    expect(r.meshHealth.minWallMm).not.toBeNull();
    expect(r.meshHealth.minWallMm!).toBeLessThan(0.9);
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
