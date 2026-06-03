import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PendantShape } from '@/types/accessory';

/**
 * 生成結果（mesh表示用）。CADデータ(構造JSON)とは分離する。
 *   parts: 描画する各メッシュ
 *   bounds: 外形寸法 mm（カメラフィット & 体積概算に使用）
 */
export interface BuiltPart {
  id: string;
  geometry: THREE.BufferGeometry;
  role: 'metal' | 'stone';
  /** roleがstoneのときの色 */
  color?: string;
  /** ハイライト対象のcomponent type */
  componentType?: string;
}

export interface BuiltModel {
  parts: BuiltPart[];
  bounds: { width: number; height: number; depth: number };
}

// ---------------------------------------------------------------------------
// 断面プロファイルを円周方向に掃引してバンド（リング状ソリッド）を作る
// ---------------------------------------------------------------------------

/**
 * profile: 断面の閉ポリゴン。各点 (u, v)
 *   u = 半径方向オフセット（センターラインからの距離 mm, +で外側）
 *   v = 軸方向位置（バンド幅方向 mm, 中心0）
 * R: センターライン半径 mm
 * 戻り: 円環トポロジの BufferGeometry（端キャア不要＝閉曲面）
 */
export function sweepProfile(profile: THREE.Vector2[], R: number, segments = 160): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const n = profile.length;

  for (let s = 0; s <= segments; s++) {
    const theta = (s / segments) * Math.PI * 2;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    for (let i = 0; i < n; i++) {
      const u = profile[i].x; // radial
      const v = profile[i].y; // axial (z)
      const r = R + u;
      positions.push(r * ct, r * st, v);
      // UV: u=周方向, v=断面方向（roughnessMap等の微細表現用）
      uvs.push(s / segments, i / Math.max(1, n - 1));
    }
  }

  for (let s = 0; s < segments; s++) {
    for (let i = 0; i < n; i++) {
      const a = s * n + i;
      const b = s * n + ((i + 1) % n);
      const c = (s + 1) * n + i;
      const d = (s + 1) * n + ((i + 1) % n);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// リング断面プロファイル
// ---------------------------------------------------------------------------

/** 角丸ヘルパ：矩形断面（必要なら四隅を丸める） */
export function rectProfile(thickness: number, width: number, round = 0): THREE.Vector2[] {
  const t = thickness / 2;
  const w = width / 2;
  const r = Math.min(round, t * 0.9, w * 0.9);
  if (r <= 0.001) {
    return [
      new THREE.Vector2(-t, -w),
      new THREE.Vector2(t, -w),
      new THREE.Vector2(t, w),
      new THREE.Vector2(-t, w),
    ];
  }
  const pts: THREE.Vector2[] = [];
  const seg = 5;
  const corners = [
    { cx: t - r, cy: w - r, a0: 0 },
    { cx: -t + r, cy: w - r, a0: Math.PI / 2 },
    { cx: -t + r, cy: -w + r, a0: Math.PI },
    { cx: t - r, cy: -w + r, a0: (3 * Math.PI) / 2 },
  ];
  for (const c of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = c.a0 + (i / seg) * (Math.PI / 2);
      pts.push(new THREE.Vector2(c.cx + r * Math.cos(a), c.cy + r * Math.sin(a)));
    }
  }
  return pts;
}

/** 面取り断面（平打＋端面チャンファ）。クリスプで現代的な高級バンド */
export function chamferProfile(thickness: number, width: number, chamfer?: number): THREE.Vector2[] {
  const t = thickness / 2;
  const w = width / 2;
  const c = Math.min(chamfer ?? Math.min(t, w) * 0.32, t * 0.7, w * 0.5);
  // 八角形（矩形の四隅を45°カット）。rectProfileと同じCCW巻き。x=radial, y=axial(z)
  return [
    new THREE.Vector2(-t + c, -w),
    new THREE.Vector2(t - c, -w),
    new THREE.Vector2(t, -w + c),
    new THREE.Vector2(t, w - c),
    new THREE.Vector2(t - c, w),
    new THREE.Vector2(-t + c, w),
    new THREE.Vector2(-t, w - c),
    new THREE.Vector2(-t, -w + c),
  ];
}

/** コンフォート（甲丸）断面: 外側=なめらかなドーム / 内側=指あたりの良いフラット寄り */
export function comfortProfile(thickness: number, width: number, seg = 12): THREE.Vector2[] {
  const t = thickness / 2;
  const w = width / 2;
  const pts: THREE.Vector2[] = [];
  // 内側フラット面（x=-t）: 下→上
  pts.push(new THREE.Vector2(-t, -w * 0.92));
  pts.push(new THREE.Vector2(-t, w * 0.92));
  pts.push(new THREE.Vector2(-t + t * 0.15, w)); // 上の小肩
  // 外側ドーム（x:+方向へ膨らむ半楕円）: 上→下
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI - Math.PI / 2; // -90°..+90°
    pts.push(new THREE.Vector2(t * Math.cos(a), w * 0.96 * Math.sin(a) * -1));
  }
  pts.push(new THREE.Vector2(-t + t * 0.15, -w)); // 下の小肩
  pts.reverse(); // sweepProfileで外向き法線になる巻き（CCW）に揃える
  return pts;
}

/** 楕円断面（round profile） */
export function ellipseProfile(thickness: number, width: number, seg = 24): THREE.Vector2[] {
  const t = thickness / 2;
  const w = width / 2;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(new THREE.Vector2(t * Math.cos(a), w * Math.sin(a)));
  }
  return pts;
}

/** ナイフエッジ断面（外側が稜線）。sweepProfileで外向き法線になるCCW巻き */
export function knifeProfile(thickness: number, width: number): THREE.Vector2[] {
  const t = thickness / 2;
  const w = width / 2;
  return [
    new THREE.Vector2(t, 0),
    new THREE.Vector2(-t, w),
    new THREE.Vector2(-t, -w),
  ];
}

// ---------------------------------------------------------------------------
// 宝石（ブリリアント風）
// ---------------------------------------------------------------------------

/** ガードル径 d の宝石。crown(冠) + pavilion(下部) を結合 */
/**
 * 宝石の3D形状。リアルな輝きのため「平らなファセット」を持つブリリアントカットを
 * 手続き的に構築する（円柱＋円錐の簡易表現を廃止）。
 *
 *   テーブル(平らな頂面) → クラウン(ジグザグの斜面) → ガードル(外周) →
 *   パビリオン(キューレットに収束する斜面)
 *
 * 非インデックスのまま computeVertexNormals するとファセットごとに法線が立ち（フラット
 * シェーディング）、面と面の稜線がくっきり出てジュエリーらしい煌めきになる。
 */
export function makeGem(d: number, cut: string = 'round'): THREE.BufferGeometry {
  const R = d / 2;

  // カボション: 滑らかなドーム（つや石・パール用）
  if (cut === 'cabochon') {
    const g = new THREE.SphereGeometry(R, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, 0.6, 1);
    g.translate(0, -R * 0.05, 0);
    g.computeVertexNormals();
    return g;
  }

  // 対称数 N と各種比率（実際のラウンドブリリアント近似）。丸系は24分割で高精細・低ポリ感解消。
  const N = cut === 'princess' || cut === 'emerald' ? 4 : 24;
  const rt = R * (cut === 'princess' || cut === 'emerald' ? 0.66 : 0.53); // テーブル半径
  const crownH = R * 0.42; // ガードルから天面までの高さ
  const pavD = R * 0.96; // ガードルからキューレットまでの深さ
  const off = cut === 'princess' || cut === 'emerald' ? Math.PI / 4 : 0;

  const v = (ang: number, r: number, y: number): [number, number, number] => [
    Math.cos(ang) * r,
    y,
    Math.sin(ang) * r,
  ];

  const A: [number, number, number][] = []; // テーブル外周
  const B: [number, number, number][] = []; // ガードル高点（クラウン主面が降りる点）
  const C: [number, number, number][] = []; // ガードル谷点（半ピッチずらし＝スキャロップ）
  for (let i = 0; i < N; i++) {
    const a = off + (i / N) * Math.PI * 2;
    const am = off + ((i + 0.5) / N) * Math.PI * 2;
    A.push(v(a, rt, crownH));
    B.push(v(a, R, 0));
    C.push(v(am, R * 0.985, 0));
  }
  const T: [number, number, number] = [0, crownH, 0]; // テーブル中心
  const K: [number, number, number] = [0, -pavD, 0]; // キューレット

  const pos: number[] = [];
  const tri = (p: number[], q: number[], r: number[]) => {
    pos.push(p[0], p[1], p[2], q[0], q[1], q[2], r[0], r[1], r[2]);
  };
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    // テーブル（平らな頂面・中心からの扇）
    tri(T, A[j], A[i]);
    // クラウン（テーブル外周→スキャロップのジグザグ斜面）
    tri(A[i], C[i], B[i]);
    tri(A[i], A[j], C[i]);
    tri(A[j], B[j], C[i]);
    // パビリオン（ガードル→キューレットに収束）
    tri(B[i], K, C[i]);
    tri(C[i], K, B[j]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // 異形カットは縦横比で表現（ペアは下を尖らせる）
  if (cut === 'oval') geo.scale(1.35, 1, 0.82);
  else if (cut === 'marquise') geo.scale(1.7, 1, 0.6);
  else if (cut === 'pear') geo.scale(0.95, 1, 1.25);
  else if (cut === 'emerald') geo.scale(1.4, 1, 0.95);
  geo.computeVertexNormals(); // 非インデックス→フラット法線（ファセットが立つ）
  return geo;
}

/**
 * ミル打ち（ミルグレイン）。円周に沿って並ぶ微小な金属の粒。
 * 高級ジュエリーの象徴的な縁飾り。XY平面の半径 R・高さ z に粒を並べる。
 * 呼び出し側で必要に応じ回転・移動する。
 */
export function makeMilgrain(R: number, z: number, beadR = 0.2, a0 = 0, a1 = Math.PI * 2): THREE.BufferGeometry {
  const span = a1 - a0;
  const arcLen = Math.abs(span) * R;
  const count = Math.max(6, Math.min(240, Math.round(arcLen / (beadR * 2.1))));
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const a = a0 + (i / (count - (span < Math.PI * 1.99 ? 1 : 0))) * span;
    const b = new THREE.SphereGeometry(beadR, 7, 6);
    b.translate(Math.cos(a) * R, Math.sin(a) * R, z);
    geos.push(b);
  }
  const merged = mergeGeometries(geos, false)!;
  merged.computeVertexNormals();
  return merged;
}

/**
 * パヴェ／エタニティ留め: バンド外周の弧 [a0,a1] に小粒石を一列に並べ、
 * 両縁にミル打ちレール（石を留める粒）を回す。XY平面・バンド軸=Z。
 * 戻り値は {stones: gem geometries, rails: metal geometry}。
 */
export function makePave(
  outerR: number,
  bandWidth: number,
  a0: number,
  a1: number,
): { stones: THREE.BufferGeometry[]; rails: THREE.BufferGeometry } {
  const span = a1 - a0;
  const full = span >= Math.PI * 1.99;
  // 1粒ずつ認識できる大きさ・間隔（“光の線”にしない）
  const sd = Math.min(bandWidth * 0.62, 2.0);
  const pitch = sd * 1.32; // 石間隔（石径より広く取り、間に粒留めが入る）
  const n = Math.max(4, Math.round((Math.abs(span) * outerR) / pitch));

  const stones: THREE.BufferGeometry[] = [];
  const angs: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = full ? i / n : i / (n - 1);
    const ang = a0 + t * span;
    angs.push(ang);
    const gem = makeGem(sd, 'round');
    gem.rotateZ(ang - Math.PI / 2); // テーブルを半径方向の外へ
    const rr = outerR - sd * 0.08; // ガードルがバンド面に沈む
    gem.translate(Math.cos(ang) * rr, Math.sin(ang) * rr, 0);
    stones.push(gem);
  }

  // 粒留め（ビーズ）: 石と石の境界の両縁に1粒ずつ置く＝ビーズセッティングの構造感
  const beadR = Math.max(0.13, sd * 0.16);
  const railZ = Math.min(bandWidth / 2 - beadR * 0.9, sd * 0.6);
  const bAngs: number[] = [];
  for (let i = 0; i < n - 1; i++) bAngs.push((angs[i] + angs[i + 1]) / 2);
  if (full) bAngs.push((angs[n - 1] + angs[0] + Math.PI * 2) / 2);
  else {
    // 端の粒留め
    const half = (span / Math.max(1, n - 1)) / 2;
    bAngs.push(a0 - half, a1 + half);
  }
  const beadGeos: THREE.BufferGeometry[] = [];
  for (const ba of bAngs) {
    for (const z of [railZ, -railZ]) {
      const b = new THREE.SphereGeometry(beadR, 8, 7);
      b.translate(Math.cos(ba) * (outerR + beadR * 0.2), Math.sin(ba) * (outerR + beadR * 0.2), z);
      beadGeos.push(b);
    }
  }
  const rails = mergeGeometries(beadGeos, false)!;
  rails.computeVertexNormals();
  return { stones, rails };
}

/**
 * 覆輪（ベゼル）の石座。石のガードルを抱える、わずかにテーパーした金属の壁。
 * 正準向き: 石の軸＝+Y / ガードル面 y=0 / テーブル上。呼び出し側で回転・移動する。
 */
export function makeBezel(d: number): THREE.BufferGeometry {
  const r = d / 2;
  const h = d * 0.5;
  // 断面（x=半径, y=高さ）を閉ループにして回転＝肉厚のある覆輪バンド
  const prof = [
    new THREE.Vector2(r + 0.18, h * 0.62), // 内・上（石を抱える縁）
    new THREE.Vector2(r + 0.52, h * 0.45), // 外・上
    new THREE.Vector2(r + 0.52, -h * 0.28), // 外・下
    new THREE.Vector2(r + 0.22, -h * 0.28), // 内・下
    new THREE.Vector2(r + 0.18, h * 0.62), // 閉じる
  ];
  const g = new THREE.LatheGeometry(prof, 56);
  g.computeVertexNormals();
  return g;
}

/**
 * 爪（プロング）留めの石座。先玉付きで、石を抱えるように内側へ倒れた絞り爪をcount本。
 * 正準向き: 石の軸＝+Y。呼び出し側で回転・移動する。
 */
export function makeProngs(d: number, count = 4): THREE.BufferGeometry {
  const r = d / 2 + 0.04; // 爪はガードルのすぐ外
  const baseY = -d * 0.14; // 爪根元（ガードル下）
  const tipY = d * 0.46; // 爪先（クラウン上＝石にかぶさる高さ）
  const H = tipY - baseY;
  const beadR = Math.max(0.18, d * 0.06);
  const tilt = 0.14; // 爪先が石にかぶさる角
  const geos: THREE.BufferGeometry[] = [];

  // バスケット: 爪根元を繋ぐ細い輪（石が留まっている構造の説得力）
  const basket = new THREE.TorusGeometry(d / 2 + 0.02, Math.max(0.1, d * 0.045), 8, 30);
  basket.rotateX(Math.PI / 2);
  basket.translate(0, baseY + d * 0.06, 0);
  geos.push(basket);

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.PI / count;
    // 爪本体（下太・上細のテーパー） + 先玉（石にかぶさる）
    const claw = new THREE.CylinderGeometry(d * 0.05, d * 0.1, H, 12);
    claw.translate(0, baseY + H / 2, 0);
    const bead = new THREE.SphereGeometry(beadR, 12, 12);
    bead.translate(0, tipY, 0);
    let one = mergeGeometries([claw, bead], false)!;
    one.rotateZ(tilt); // 上端を -X（内側）へ倒し石を抱える
    one.rotateY(-a); // -X を中心方向に合わせる
    one.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
    geos.push(one);
  }
  const merged = mergeGeometries(geos, false)!;
  merged.computeVertexNormals();
  return merged;
}

// ---------------------------------------------------------------------------
// ペンダント 2D 外形 → THREE.Shape
// ---------------------------------------------------------------------------

export function buildShape(
  shape: PendantShape,
  w: number,
  h: number,
  cornerRadius: number,
  outline?: { x: number; y: number }[]
): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const s = new THREE.Shape();

  // 画像トレース由来のカスタム外形（単位ボックス正規化）を width/height でスケール
  if (shape === 'custom' && outline && outline.length >= 3) {
    s.moveTo(outline[0].x * w, outline[0].y * h);
    for (let i = 1; i < outline.length; i++) s.lineTo(outline[i].x * w, outline[i].y * h);
    s.closePath();
    return s;
  }

  switch (shape) {
    case 'disc':
    case 'oval': {
      const sx = shape === 'oval' ? hw : Math.min(hw, hh);
      const sy = shape === 'oval' ? hh : Math.min(hw, hh);
      s.absellipse(0, 0, sx, sy, 0, Math.PI * 2, false, 0);
      break;
    }
    case 'hexagon': {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const x = hw * Math.cos(a);
        const y = hh * Math.sin(a);
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      s.closePath();
      break;
    }
    case 'heart': {
      // ハート曲線
      const n = 60;
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y =
          13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        const px = (x / 17) * hw;
        const py = (y / 17) * hh;
        if (i === 0) s.moveTo(px, py);
        else s.lineTo(px, py);
      }
      s.closePath();
      break;
    }
    case 'shield': {
      s.moveTo(-hw, hh);
      s.lineTo(hw, hh);
      s.lineTo(hw, -hh * 0.2);
      s.quadraticCurveTo(hw, -hh * 0.7, 0, -hh);
      s.quadraticCurveTo(-hw, -hh * 0.7, -hw, -hh * 0.2);
      s.closePath();
      break;
    }
    case 'tag':
    case 'rect':
    default: {
      const r = Math.min(cornerRadius, hw * 0.9, hh * 0.9);
      s.moveTo(-hw + r, -hh);
      s.lineTo(hw - r, -hh);
      s.quadraticCurveTo(hw, -hh, hw, -hh + r);
      s.lineTo(hw, hh - r);
      s.quadraticCurveTo(hw, hh, hw - r, hh);
      s.lineTo(-hw + r, hh);
      s.quadraticCurveTo(-hw, hh, -hw, hh - r);
      s.lineTo(-hw, -hh + r);
      s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
      s.closePath();
      break;
    }
  }
  return s;
}

/** 円形の穴パス（shape.holes に追加して打ち抜く） */
export function circleHole(cx: number, cy: number, r: number): THREE.Path {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}
