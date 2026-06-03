import * as THREE from 'three';
import type { AccessoryDesign, PendantParams } from '@/types/accessory';
import { BuiltModel, BuiltPart, buildShape, circleHole, makeGem } from './primitives';

/**
 * ペンダントのパラメトリック生成。
 *   - 本体: 外形Shapeを厚みぶん押し出し。穴(bail/装飾)はShape.holesで打ち抜き
 *   - バチカン: ring_bail / tube はトーラスを上部に追加
 *   - 石/刻印: 表面に配置
 */
export function buildPendant(design: AccessoryDesign, p: PendantParams): BuiltModel {
  const parts: BuiltPart[] = [];

  const shape = buildShape(p.shape, p.width, p.height, p.cornerRadius, p.outline);
  const topY = p.height / 2;

  // 一体型吊り穴（本体に穴をあける）
  // チェーン/吊り元の接続点（ネックレスのチェーンはここから生やす）
  let bailConnectX = 0;
  let bailConnectY = topY;

  if (p.bail.type === 'integrated_hole') {
    const r = p.bail.innerDiameter / 2;
    let holeCx = 0;
    let holeY = topY - p.bail.wall - r;

    // カスタム外形では top-center が外側になり得るので、内部の安全な位置を探す
    if (p.shape === 'custom' && p.outline && p.outline.length >= 3) {
      const poly = p.outline.map((pt) => ({ x: pt.x * p.width, y: pt.y * p.height }));
      const safe = findTopInteriorHole(poly, p.bail.wall + r, r);
      if (safe) {
        holeCx = safe.x;
        holeY = safe.y;
      } else {
        // 安全な位置が無ければ穴は開けない（本体は維持）
        holeCx = NaN;
      }
    }
    if (!Number.isNaN(holeCx)) {
      shape.holes.push(circleHole(holeCx, holeY, r));
      bailConnectX = holeCx;
      bailConnectY = holeY; // チェーンは穴の中心から接続
    }
  }

  // 装飾穴
  for (const h of design.holes.filter((x) => x.role !== 'bail')) {
    shape.holes.push(circleHole(h.position.x, h.position.y, h.diameter / 2));
  }

  const body = new THREE.ExtrudeGeometry(shape, {
    depth: p.thickness,
    bevelEnabled: true,
    bevelSize: Math.min(0.25, p.thickness * 0.15),
    bevelThickness: Math.min(0.25, p.thickness * 0.15),
    bevelSegments: 2,
    curveSegments: 48,
  });
  body.translate(0, 0, -p.thickness / 2);
  body.computeVertexNormals();
  parts.push({ id: 'body', geometry: body, role: 'metal', componentType: 'body' });

  // リングバチカン / チューブバチカン
  if (p.bail.type === 'ring_bail' || p.bail.type === 'tube') {
    const r = p.bail.innerDiameter / 2 + p.bail.wall;
    const torus = new THREE.TorusGeometry(r, p.bail.wall, 16, 32);
    torus.translate(0, topY + r * 0.6, 0);
    parts.push({ id: 'bail', geometry: torus, role: 'metal', componentType: 'bail' });
    bailConnectY = topY + r * 0.6 + r; // チェーンは丸カンの上から接続
  }

  // 石
  for (let i = 0; i < design.stones.length; i++) {
    const st = design.stones[i];
    const gem = makeGem(st.diameter, st.cut);
    gem.rotateX(Math.PI / 2); // 表面（+Z）を向ける
    gem.translate(st.position.x, st.position.y, p.thickness / 2 + st.diameter * 0.15);
    parts.push({ id: `stone-${i}`, geometry: gem, role: 'stone', color: st.color });

    if (st.setting === 'bezel') {
      const bezel = new THREE.TorusGeometry(st.diameter / 2 + 0.3, 0.4, 12, 24);
      bezel.translate(st.position.x, st.position.y, p.thickness / 2);
      parts.push({ id: `bezel-${i}`, geometry: bezel, role: 'metal', componentType: 'border' });
    }
  }

  // ネックレス: 吊り穴/バチカンの接続点から上へ2本のチェーンを生成（ペンダントと連結）
  let chainRise = 0;
  if (design.category === 'necklace') {
    const tube = 0.45;
    const linkR = 1.4;
    const N = 18;
    const reach = Math.max(p.width, 20) * 0.7;
    const rise = Math.max(p.height, 22) * 1.6;
    chainRise = rise + (bailConnectY - topY) + linkR;

    const addLink = (x: number, y: number, i: number, id: string) => {
      const link = new THREE.TorusGeometry(linkR, tube, 8, 16);
      // 交互に向きを変えて鎖の絡みを表現
      if (i % 2 === 0) link.rotateY(Math.PI / 2);
      else link.rotateX(Math.PI / 2);
      link.translate(x, y, 0);
      parts.push({ id, geometry: link, role: 'metal', componentType: 'bail' });
    };

    // 接続リング: 吊り穴/バチカンを通すジャンプリング（ペンダントと鎖をつなぐ）
    addLink(bailConnectX, bailConnectY, 1, 'chain-connector');

    // そこから2本のチェーンがV字に立ち上がる
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 1; i <= N; i++) {
        const t = i / N;
        const x = bailConnectX + side * Math.sin((t * Math.PI) / 2) * reach;
        const y = bailConnectY + t * rise;
        addLink(x, y, i, `chain-${side}-${i}`);
      }
    }
  }

  return {
    parts,
    bounds: {
      width: p.width,
      height: p.height + (p.bail.type === 'ring_bail' ? p.bail.innerDiameter : 0) + chainRise,
      depth: p.thickness,
    },
  };
}

/** 点が多角形の内部にあるか（ray casting） */
function pointInPolygon(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * カスタム外形の上部に、吊り穴を開けられる安全な内部点を探す。
 * 上から走査し、穴の半径ぶんマージンを確保できる位置を返す。
 */
function findTopInteriorHole(
  poly: { x: number; y: number }[],
  topMargin: number,
  r: number
): { x: number; y: number } | null {
  let minY = Infinity, maxY = -Infinity, sumX = 0;
  for (const p of poly) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    sumX += p.x;
  }
  const cx = sumX / poly.length;
  const span = maxY - minY;
  // 上から下へ、穴中心候補を走査
  for (let y = maxY - topMargin; y > minY + r; y -= span * 0.02) {
    // 中心と左右にマージンぶん離れた点も内部かを確認（穴が縁を割らないように）
    if (
      pointInPolygon(cx, y, poly) &&
      pointInPolygon(cx, y + r, poly) &&
      pointInPolygon(cx - r, y, poly) &&
      pointInPolygon(cx + r, y, poly) &&
      pointInPolygon(cx, y - r, poly)
    ) {
      return { x: cx, y };
    }
  }
  return null;
}
