import * as THREE from 'three';
import type {
  AccessoryDesign,
  BraceletParams,
  EarringsParams,
  GenericParams,
} from '@/types/accessory';
import { BuiltModel, BuiltPart } from './primitives';

/** ピアス（簡易）：本体プレート + ポスト/フック or フープ */
export function buildEarrings(_design: AccessoryDesign, p: EarringsParams): BuiltModel {
  const parts: BuiltPart[] = [];

  if (p.style === 'hoop') {
    const r = p.hoopDiameter / 2;
    const torus = new THREE.TorusGeometry(r, p.wireDiameter / 2, 16, 48);
    parts.push({ id: 'hoop', geometry: torus, role: 'metal', componentType: 'hoop' });
    return { parts, bounds: { width: p.hoopDiameter, height: p.hoopDiameter, depth: p.wireDiameter } };
  }

  const body = new THREE.BoxGeometry(p.bodyWidth, p.bodyHeight, p.thickness);
  parts.push({ id: 'stud', geometry: body, role: 'metal', componentType: 'stud' });

  if (p.style === 'hook') {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, p.bodyHeight / 2, 0),
      new THREE.Vector3(0, p.bodyHeight / 2 + 4, -3),
      new THREE.Vector3(2, p.bodyHeight / 2 + 8, -2),
      new THREE.Vector3(3, p.bodyHeight / 2 + 6, 1),
    ]);
    const hook = new THREE.TubeGeometry(curve, 32, p.wireDiameter / 2, 8, false);
    parts.push({ id: 'hook', geometry: hook, role: 'metal', componentType: 'hook' });
  } else {
    // スタッド：背面ポスト
    const post = new THREE.CylinderGeometry(p.wireDiameter / 2, p.wireDiameter / 2, 8, 12);
    post.rotateX(Math.PI / 2);
    post.translate(0, 0, -4 - p.thickness / 2);
    parts.push({ id: 'post', geometry: post, role: 'metal', componentType: 'connector' });
  }

  return { parts, bounds: { width: p.bodyWidth, height: p.bodyHeight, depth: p.thickness } };
}

/** 円弧上に正しい向き（接線方向）でパーツを並べるためのジオメトリ配置ヘルパ */
function placeOnArc(geo: THREE.BufferGeometry, R: number, angle: number): THREE.BufferGeometry {
  // geoのローカルX軸を円の接線方向に向け、半径R・角度angleの位置へ移動
  geo.rotateZ(angle + Math.PI / 2);
  geo.translate(R * Math.cos(angle), R * Math.sin(angle), 0);
  return geo;
}

/**
 * ブレスレット。手首に巻いた円弧（下に留め具の隙間）として表現。
 *   - bangle: 開いたバングル（太い円弧）
 *   - plate : 上部に中央プレート + 両サイドに細い円弧バンド
 *   - link  : 角丸リンクを円弧上に等間隔配置（接線方向に整列）
 */
export function buildBracelet(_design: AccessoryDesign, p: BraceletParams): BuiltModel {
  const parts: BuiltPart[] = [];
  const R = p.innerCircumference / (Math.PI * 2);
  const TOP = Math.PI / 2; // 上(12時)を中心に配置
  const span = Math.PI * (5 / 3); // 300°ぶん（下60°を留め具の隙間に）

  // 開口部を下に向けた円弧トーラスを作るユーティリティ
  const arcBand = (tube: number) => {
    const t = new THREE.TorusGeometry(R, tube, 18, 120, span);
    // TorusはX軸正(0°)から描画。中心を上(90°)に持ってくるよう回転
    t.rotateZ(TOP - span / 2);
    return t;
  };

  if (p.style === 'bangle') {
    parts.push({ id: 'bangle', geometry: arcBand(p.thickness / 2 + 0.6), role: 'metal', componentType: 'plate' });
    return { parts, bounds: { width: R * 2.2, height: R * 2.2, depth: p.plateWidth } };
  }

  if (p.style === 'link') {
    const n = Math.max(6, p.linkCount * 2 + 1);
    const linkLen = (span * R) / (n + 0.5) * 0.8;
    for (let i = 0; i < n; i++) {
      const a = TOP - span / 2 + ((i + 0.5) / n) * span;
      const box = new THREE.BoxGeometry(linkLen, p.plateWidth * 0.8, p.thickness);
      placeOnArc(box, R, a);
      parts.push({ id: `link-${i}`, geometry: box, role: 'metal', componentType: 'link' });
    }
    return { parts, bounds: { width: R * 2.2, height: R * 2.2, depth: p.plateWidth } };
  }

  // plate スタイル: 細いサイドバンド + 上部中央プレート
  parts.push({ id: 'band', geometry: arcBand(p.thickness / 2), role: 'metal', componentType: 'link' });

  // 中央プレート（上部に接線方向で配置、外側へ少しオフセット）
  const plate = new THREE.BoxGeometry(p.plateLength, p.plateWidth, p.thickness * 1.2);
  placeOnArc(plate, R + p.thickness * 0.2, TOP);
  parts.push({ id: 'plate', geometry: plate, role: 'metal', componentType: 'plate' });

  return { parts, bounds: { width: R * 2.2, height: R * 2.2, depth: p.plateWidth } };
}

/** 汎用フォールバック：角丸ボックス */
export function buildGeneric(_design: AccessoryDesign, p: GenericParams): BuiltModel {
  const geo = new THREE.BoxGeometry(p.width, p.height, p.thickness);
  return {
    parts: [{ id: 'body', geometry: geo, role: 'metal', componentType: 'body' }],
    bounds: { width: p.width, height: p.height, depth: p.thickness },
  };
}
