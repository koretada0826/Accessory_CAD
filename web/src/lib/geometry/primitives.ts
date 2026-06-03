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

/** ナイフエッジ断面（外側が稜線） */
export function knifeProfile(thickness: number, width: number): THREE.Vector2[] {
  const t = thickness / 2;
  const w = width / 2;
  return [
    new THREE.Vector2(-t, -w),
    new THREE.Vector2(-t, w),
    new THREE.Vector2(t, 0),
  ];
}

// ---------------------------------------------------------------------------
// 宝石（ブリリアント風）
// ---------------------------------------------------------------------------

/** ガードル径 d の宝石。crown(冠) + pavilion(下部) を結合 */
export function makeGem(d: number, cut: string = 'round'): THREE.BufferGeometry {
  const facets = cut === 'princess' ? 4 : cut === 'oval' || cut === 'pear' ? 12 : 8;
  const girdle = d / 2;
  const table = girdle * 0.55;
  const crownH = d * 0.18;
  const pavH = d * 0.5;

  if (cut === 'cabochon') {
    const g = new THREE.SphereGeometry(girdle, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, 0.55, 1);
    g.computeVertexNormals();
    return g;
  }

  const crown = new THREE.CylinderGeometry(table, girdle, crownH, facets);
  crown.translate(0, crownH / 2, 0);
  const pav = new THREE.ConeGeometry(girdle, pavH, facets);
  pav.rotateX(Math.PI); // 先端を下に
  pav.translate(0, -pavH / 2, 0);
  const merged = mergeGeometries([crown, pav], false)!;
  if (cut === 'oval' || cut === 'marquise') merged.scale(1.4, 1, 0.7);
  if (cut === 'pear') merged.scale(1, 1, 1.2);
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
