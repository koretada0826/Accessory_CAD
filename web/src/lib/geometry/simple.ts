import * as THREE from 'three';
import type {
  AccessoryDesign,
  BraceletParams,
  EarringsParams,
  GenericParams,
} from '@/types/accessory';
import { BuiltModel, BuiltPart, makeGem } from './primitives';

/** 角丸プレート（前面=+Z）。ピアス本体に使用 */
function plateGeometry(w: number, h: number, t: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const hw = w / 2, hh = h / 2, r = Math.min(hw, hh) * 0.5;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 2, curveSegments: 24 });
  g.translate(0, 0, -t / 2);
  g.computeVertexNormals();
  return g;
}

/** フレンチフック（耳に通す釣り針状ワイヤー・前面XY平面） */
function frenchHook(topY: number, wire: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, topY, 0),
    new THREE.Vector3(0.3, topY + 4, 0),
    new THREE.Vector3(-1.6, topY + 9, 0),
    new THREE.Vector3(-4.5, topY + 8.5, 0),
    new THREE.Vector3(-5.2, topY + 4.5, 0),
    new THREE.Vector3(-3.6, topY + 3, 0),
  ]);
  return new THREE.TubeGeometry(curve, 48, wire / 2, 10, false);
}

/** 宝石を本体前面に配置 */
function pushStones(design: AccessoryDesign, t: number, parts: BuiltPart[]) {
  design.stones.forEach((st, i) => {
    const gem = makeGem(st.diameter, st.cut);
    gem.rotateX(Math.PI / 2);
    gem.translate(st.position.x, st.position.y, t / 2 + st.diameter * 0.15);
    parts.push({ id: `stone-${i}`, geometry: gem, role: 'stone', color: st.color });
  });
}

/**
 * ピアス。スタイル別に上質な作り。
 *   - stud : 角丸プレート + 背面ポスト + キャッチ（蝶バネ風ディスク）
 *   - hook : フレンチフック + 揺れる本体プレート
 *   - hoop : フープ（トーラス）
 *   - drop : フレンチフック + 接続丸カン + ドロップ本体
 */
export function buildEarrings(design: AccessoryDesign, p: EarringsParams): BuiltModel {
  const parts: BuiltPart[] = [];
  const wire = p.wireDiameter;

  if (p.style === 'hoop') {
    const r = p.hoopDiameter / 2;
    const torus = new THREE.TorusGeometry(r, wire / 2, 18, 64);
    parts.push({ id: 'hoop', geometry: torus, role: 'metal', componentType: 'hoop' });
    // フープにも石を載せられる
    pushStones(design, wire, parts);
    return { parts, bounds: { width: p.hoopDiameter, height: p.hoopDiameter, depth: p.hoopDiameter } };
  }

  if (p.style === 'stud') {
    const body = plateGeometry(p.bodyWidth, p.bodyHeight, p.thickness);
    parts.push({ id: 'stud', geometry: body, role: 'metal', componentType: 'stud' });
    // 背面ポスト
    const post = new THREE.CylinderGeometry(wire / 2, wire / 2, 9, 14);
    post.rotateX(Math.PI / 2);
    post.translate(0, 0, -4.5 - p.thickness / 2);
    parts.push({ id: 'post', geometry: post, role: 'metal', componentType: 'connector' });
    // キャッチ（蝶バネ風の小ディスク）
    const catchDisc = new THREE.CylinderGeometry(1.6, 1.6, 0.8, 16);
    catchDisc.rotateX(Math.PI / 2);
    catchDisc.translate(0, 0, -8 - p.thickness / 2);
    parts.push({ id: 'catch', geometry: catchDisc, role: 'metal', componentType: 'connector' });
    pushStones(design, p.thickness, parts);
    return { parts, bounds: { width: p.bodyWidth, height: p.bodyHeight, depth: 9 } };
  }

  // hook / drop : フレンチフック + 本体
  const bodyTopY = p.style === 'drop' ? -2 : p.bodyHeight / 2;
  const hook = frenchHook(bodyTopY + (p.style === 'drop' ? p.bodyHeight + 2 : 0.5), wire);
  parts.push({ id: 'hook', geometry: hook, role: 'metal', componentType: 'hook' });

  let bodyGeo: THREE.BufferGeometry;
  if (p.style === 'drop') {
    // ドロップ（雫）: 楕円を縦に、上を細く
    const s = new THREE.Shape();
    const w = p.bodyWidth / 2, h = p.bodyHeight / 2;
    s.moveTo(0, h * 1.1);
    s.quadraticCurveTo(w, h * 0.2, w * 0.7, -h * 0.7);
    s.quadraticCurveTo(0, -h * 1.1, -w * 0.7, -h * 0.7);
    s.quadraticCurveTo(-w, h * 0.2, 0, h * 1.1);
    bodyGeo = new THREE.ExtrudeGeometry(s, { depth: p.thickness, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 2, curveSegments: 24 });
    bodyGeo.translate(0, -p.bodyHeight / 2 - 2, -p.thickness / 2);
  } else {
    bodyGeo = plateGeometry(p.bodyWidth, p.bodyHeight, p.thickness);
  }
  bodyGeo.computeVertexNormals();
  parts.push({ id: 'drop', geometry: bodyGeo, role: 'metal', componentType: p.style === 'drop' ? 'drop' : 'stud' });

  pushStones(design, p.thickness, parts);
  const h = p.bodyHeight + 12;
  return { parts, bounds: { width: Math.max(p.bodyWidth, 10), height: h, depth: p.thickness } };
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

/** 汎用 / イヤーカフ。earcuff は耳に挟むC字バンドとして生成 */
export function buildGeneric(design: AccessoryDesign, p: GenericParams): BuiltModel {
  if (design.category === 'earcuff') {
    const parts: BuiltPart[] = [];
    const R = Math.max(4, p.width / 2);
    const tube = Math.max(0.8, p.thickness);
    const arc = Math.PI * 1.45; // 開いたC字（約260°）
    const cuff = new THREE.TorusGeometry(R, tube, 20, 80, arc);
    // 開口部を下に向ける
    cuff.rotateZ(Math.PI / 2 - arc / 2);
    parts.push({ id: 'cuff', geometry: cuff, role: 'metal', componentType: 'body' });
    // 端の装飾ボール（引っかかり防止＆見栄え）
    for (const end of [0, arc]) {
      const a = Math.PI / 2 - arc / 2 + end;
      const ball = new THREE.SphereGeometry(tube * 1.25, 16, 12);
      ball.translate(R * Math.cos(a), R * Math.sin(a), 0);
      parts.push({ id: `cuff-end-${end}`, geometry: ball, role: 'metal', componentType: 'body' });
    }
    // 石（あれば前面に）
    design.stones.forEach((st, i) => {
      const gem = makeGem(st.diameter, st.cut);
      gem.rotateX(Math.PI / 2);
      gem.translate(st.position.x, R, st.position.y + tube);
      parts.push({ id: `stone-${i}`, geometry: gem, role: 'stone', color: st.color });
    });
    return { parts, bounds: { width: R * 2 + tube * 2, height: R * 2 + tube * 2, depth: tube * 3 } };
  }

  const geo = new THREE.BoxGeometry(p.width, p.height, p.thickness);
  return {
    parts: [{ id: 'body', geometry: geo, role: 'metal', componentType: 'body' }],
    bounds: { width: p.width, height: p.height, depth: p.thickness },
  };
}
