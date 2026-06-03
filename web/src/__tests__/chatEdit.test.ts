import { describe, it, expect } from 'vitest';
import { applyChatEdit } from '@/lib/ai/chatEdit';
import { createDesign } from '@/lib/data/factory';

describe('chatEdit', () => {
  it('「13号にして」で内径が13号相当に変わる', () => {
    const r = applyChatEdit('13号にして', createDesign('ring'));
    expect(r.changed).toBe(true);
    if (r.design.params.kind === 'ring') {
      expect(r.design.params.innerDiameter).toBeCloseTo((13 + 39) / Math.PI, 1);
    }
  });

  it('「ルビーを入れて」で石が追加され赤系の色になる', () => {
    const r = applyChatEdit('ルビーを入れて', createDesign('pendant'));
    expect(r.changed).toBe(true);
    expect(r.design.stones.length).toBe(1);
    expect(r.design.stones[0].color.toLowerCase()).toBe('#e0234e');
  });

  it('「ホワイトゴールドにして」で素材が変わる', () => {
    const r = applyChatEdit('ホワイトゴールドにして', createDesign('ring'));
    expect(r.design.materialId).toBe('gold_white');
  });

  it('「"LOVE"と刻んで」でペンダントに刻印が入る', () => {
    const r = applyChatEdit('"LOVE"と刻んで', createDesign('pendant'));
    expect(r.design.engraving.length).toBe(1);
    expect(r.design.engraving[0].text).toBe('LOVE');
  });

  it('複合指示「ルビーを入れて中央に、ホワイトゴールドに」が同時反映', () => {
    const r = applyChatEdit('ルビーを入れて中央に、ホワイトゴールドに', createDesign('pendant'));
    expect(r.design.stones.length).toBe(1);
    expect(r.design.stones[0].position).toEqual({ x: 0, y: 0 });
    expect(r.design.materialId).toBe('gold_white');
  });

  it('解釈不能な入力では changed=false', () => {
    const r = applyChatEdit('こんにちは', createDesign('ring'));
    expect(r.changed).toBe(false);
  });
});
