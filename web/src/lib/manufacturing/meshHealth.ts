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
  /** レイキャストで実測した最小肉厚 mm（測れない場合 null） */
  minWallMm: number | null;
  /** 最小肉厚が観測されたパーツid */
  thinnestPart: string | null;
}

export function analyzeMeshHealth(model: BuiltModel): MeshHealth {
  let triangles = 0;
  let solids = 0;
  const openParts: string[] = [];
  let minWallMm: number | null = null;
  let thinnestPart: string | null = null;

  for (const part of model.parts) {
    if (part.role !== 'metal') continue; // 宝石(transmission)は対象外
    solids++;
    const { tri, manifold } = analyzeGeometry(part.geometry);
    triangles += tri;
    if (!manifold) openParts.push(part.id);

    const t = measurePartMinWall(part.geometry);
    if (t !== null && (minWallMm === null || t < minWallMm)) {
      minWallMm = t;
      thinnestPart = part.id;
    }
  }

  return {
    allManifold: openParts.length === 0,
    solids,
    triangles,
    openParts,
    minWallMm: minWallMm === null ? null : Math.round(minWallMm * 100) / 100,
    thinnestPart,
  };
}

/**
 * 1パーツの最小肉厚をレイキャストで実測する。
 * 各三角形の重心から面の内向き(-法線)へレイを飛ばし、同一パーツの反対面までの
 * 距離を肉厚とみなす。サンプル数は上限を設けて軽量に（編集ごとに再計算されるため）。
 *
 * 近似なので「目安」。鋭角な凹部などでは過小に出るため、ごく小さい値は無視する。
 */
function measurePartMinWall(geom: { attributes: any; index: any }): number | null {
  const pos = geom.attributes?.position;
  if (!pos) return null;
  const idx = geom.index;
  const triCount = (idx ? idx.count : pos.count) / 3;
  if (triCount < 4) return null;

  // 三角形を平坦配列に展開（ax,ay,az, bx..., cx...）
  const tris: number[][] = [];
  const gi = (i: number) => (idx ? idx.getX(i) : i);
  for (let i = 0; i < triCount * 3; i += 3) {
    const a = gi(i), b = gi(i + 1), c = gi(i + 2);
    tris.push([
      pos.getX(a), pos.getY(a), pos.getZ(a),
      pos.getX(b), pos.getY(b), pos.getZ(b),
      pos.getX(c), pos.getY(c), pos.getZ(c),
    ]);
  }
  const n = tris.length;
  const SAMPLES = Math.min(130, n);
  const stride = Math.max(1, Math.floor(n / SAMPLES));
  const EPS = 1e-3;
  const walls: number[] = [];

  for (let s = 0; s < n; s += stride) {
    const T = tris[s];
    // 面法線
    const ux = T[3] - T[0], uy = T[4] - T[1], uz = T[5] - T[2];
    const vx = T[6] - T[0], vy = T[7] - T[1], vz = T[8] - T[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-9) continue;
    nx /= nl; ny /= nl; nz /= nl;
    // 重心
    const cx = (T[0] + T[3] + T[6]) / 3;
    const cy = (T[1] + T[4] + T[7]) / 3;
    const cz = (T[2] + T[5] + T[8]) / 3;
    // 内向き(-法線)へレイ
    const ox = cx - nx * EPS, oy = cy - ny * EPS, oz = cz - nz * EPS;
    const dx = -nx, dy = -ny, dz = -nz;

    let best = Infinity;
    for (let j = 0; j < n; j++) {
      if (j === s) continue;
      // 高解像メッシュでは隣接三角形に極近距離で当たる（自己隣接ノイズ）。
      // 実用上の最小肉厚(>~0.1mm)より小さい当たりは無視して反対面までを測る。
      const t = rayTri(ox, oy, oz, dx, dy, dz, tris[j]);
      if (t !== null && t > 0.12 && t < best) best = t;
    }
    if (isFinite(best)) walls.push(best);
  }

  if (walls.length === 0) return null;
  // 絶対最小はベベルのナイフエッジ等の外れ値を拾うため、下位パーセンタイル（ロバスト最小）を採用。
  walls.sort((a, b) => a - b);
  return walls[Math.floor(walls.length * 0.08)];
}

/** Möller–Trumbore: レイと三角形の交差距離 t（無ければ null）。背面も拾う */
function rayTri(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  T: number[]
): number | null {
  const e1x = T[3] - T[0], e1y = T[4] - T[1], e1z = T[5] - T[2];
  const e2x = T[6] - T[0], e2y = T[7] - T[1], e2z = T[8] - T[2];
  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-9) return null;
  const inv = 1 / det;
  const tx = ox - T[0], ty = oy - T[1], tz = oz - T[2];
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < -1e-6 || u > 1 + 1e-6) return null;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < -1e-6 || u + v > 1 + 1e-6) return null;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 0 ? t : null;
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
