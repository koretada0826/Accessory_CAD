import type { BuiltModel } from '@/lib/geometry';

/**
 * メッシュ健全性（水密/manifold）の実測判定。
 *
 * パラメータ推定ではなく、生成された実メッシュの位相を直接調べる:
 *   - 各エッジが「ちょうど2枚の三角形」に共有されていれば閉じた多様体（水密）
 *   - 1枚しか共有しないエッジ（境界エッジ）があれば穴あき/開いている
 *
 * 注意: 本ツールのプレビューは複数の独立パーツ（バンド/石座/石…）の集合。
 * 各パーツが個別に水密かを見る。3Dプリント時はスライサが集合を自動結合するため、
 * 「独立ソリッド数」も併せて報告する（情報目的）。
 */
export interface MeshHealth {
  /** 金属パーツが全て個別に水密か */
  allManifold: boolean;
  /** 金属の独立ソリッド数 */
  solids: number;
  /** 三角形総数 */
  triangles: number;
  /** 水密でないパーツのid */
  openParts: string[];
}

export function analyzeMeshHealth(model: BuiltModel): MeshHealth {
  let triangles = 0;
  let solids = 0;
  const openParts: string[] = [];

  for (const part of model.parts) {
    if (part.role !== 'metal') continue; // 宝石(transmission)は対象外
    solids++;
    const { tri, manifold } = analyzeGeometry(part.geometry);
    triangles += tri;
    if (!manifold) openParts.push(part.id);
  }

  return { allManifold: openParts.length === 0, solids, triangles, openParts };
}

/** 位置を量子化して頂点を同一視し、エッジの共有枚数を数える */
function analyzeGeometry(geom: { attributes: any; index: any }): { tri: number; manifold: boolean } {
  const pos = geom.attributes?.position;
  if (!pos) return { tri: 0, manifold: true };
  const idx = geom.index;

  const vidByKey = new Map<string, number>();
  const keyOf = (i: number) => {
    const x = Math.round(pos.getX(i) * 1e4);
    const y = Math.round(pos.getY(i) * 1e4);
    const z = Math.round(pos.getZ(i) * 1e4);
    return `${x},${y},${z}`;
  };
  const vid = (i: number) => {
    const k = keyOf(i);
    let v = vidByKey.get(k);
    if (v === undefined) {
      v = vidByKey.size;
      vidByKey.set(k, v);
    }
    return v;
  };

  const edgeCount = new Map<string, number>();
  const addEdge = (a: number, b: number) => {
    const e = a < b ? `${a}_${b}` : `${b}_${a}`;
    edgeCount.set(e, (edgeCount.get(e) ?? 0) + 1);
  };

  let tri = 0;
  const count = idx ? idx.count : pos.count;
  for (let i = 0; i < count; i += 3) {
    const ia = idx ? idx.getX(i) : i;
    const ib = idx ? idx.getX(i + 1) : i + 1;
    const ic = idx ? idx.getX(i + 2) : i + 2;
    const a = vid(ia), b = vid(ib), c = vid(ic);
    if (a === b || b === c || a === c) continue; // 退化三角形は無視
    tri++;
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }

  let manifold = true;
  for (const c of edgeCount.values()) {
    if (c !== 2) {
      manifold = false;
      break;
    }
  }
  return { tri, manifold };
}
