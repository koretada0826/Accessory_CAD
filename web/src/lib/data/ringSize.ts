/**
 * リングサイズ ⇔ 内径(mm) 変換。
 * 日本規格（号数）を主に採用し、US/EU の目安も併記。
 * 内径 = 周長 / π。日本号数は「内周(mm) = 号数 + 39」が近似式。
 */

export interface RingSizeRow {
  jp: number; // 日本号数
  us: number; // USサイズ目安
  innerDiameter: number; // mm
}

/** 号数→内径(mm)。jp号: 内周 = jp + 39 → 内径 = (jp+39)/π */
export function jpSizeToInnerDiameter(jp: number): number {
  return (jp + 39) / Math.PI;
}

export function innerDiameterToJpSize(d: number): number {
  return d * Math.PI - 39;
}

/** よく使う号数テーブル（1〜30号） */
export const RING_SIZE_TABLE: RingSizeRow[] = Array.from({ length: 30 }, (_, i) => {
  const jp = i + 1;
  return {
    jp,
    us: Math.round((jp / 2 + 0.5) * 2) / 2,
    innerDiameter: Math.round(jpSizeToInnerDiameter(jp) * 100) / 100,
  };
});

/** 内径から最も近い号数を返す */
export function nearestJpSize(d: number): number {
  return Math.max(1, Math.round(innerDiameterToJpSize(d)));
}
