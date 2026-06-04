import * as THREE from 'three';
import type { AccessoryDesign, PendantParams } from '@/types/accessory';
import { BuiltModel, BuiltPart, buildShape, circleHole, makeGem, makeBezel, makeProngs } from './primitives';

/**
 * ペンダントのパラメトリック生成。
 *   - 本体: 外形Shapeを厚みぶん押し出し。穴(bail/装飾)はShape.holesで打ち抜き
 *   - バチカン: ring_bail / tube はトーラスを上部に追加
 *   - 石/刻印: 表面に配置
 */
/**
 * 着用専用ネックレス。商品用の平面ネックレスを流用せず、
 *   - ペンダント本体は原点(=胸元/カメラ注視点)に正面向きで配置
 *   - チェーンは「首付け根の左右アンカー → ペンダント上(バチカン)」のV字を、体の前(z=0)に
 * 生成する。すべて z>=0（マネキン前面 z<-1 の前）なので貫通しない。
 * マネキン側(MannequinBust)と同じ寸法基準を使うため装着位置が整合する。
 */
export function buildWornNecklace(design: AccessoryDesign): BuiltPart[] {
  const p = design.params;
  if (p.kind !== 'pendant') return [];
  // ペンダント本体のみ（商品チェーン無し）: category を pendant 扱いで生成
  const pendantOnly: AccessoryDesign = { ...design, category: 'pendant' };
  const pend = buildPendant(pendantOnly, p);
  const parts: BuiltPart[] = [...pend.parts]; // ペンダントは原点のまま（=注視点・胸元）

  // 寸法（MannequinBust と整合）
  const chainLen = Math.max(p.height * 2.6, 46);
  const halfW = Math.max(p.width * 1.35, 18);
  const neckR = halfW * 0.5;
  const neckBaseY = chainLen * 0.78; // 首の付け根（高い位置）
  const bailY = p.height / 2 + 0.5; // ペンダント上端

  const wire = 0.18, linkLen = 1.9, linkWidth = 1.3;
  const step = linkLen * 0.5;
  const placeLink = (x: number, y: number, ang: number, parity: number, id: string) => {
    const link = makeOvalLink(linkLen, linkWidth, wire);
    const t = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
    const n = new THREE.Vector3(-Math.sin(ang), Math.cos(ang), 0);
    const up = new THREE.Vector3(0, 0, 1);
    const yAxis = parity === 0 ? up : n;
    const zAxis = new THREE.Vector3().crossVectors(t, yAxis).normalize();
    link.applyMatrix4(new THREE.Matrix4().makeBasis(t, yAxis, zAxis));
    link.translate(x, y, 0); // z=0＝体の前
    parts.push({ id, geometry: link, role: 'metal', componentType: 'bail' });
  };

  // 左右のストランド（首付け根アンカー → ペンダント上）。わずかに垂れる。
  for (const side of [-1, 1]) {
    const ax = side * neckR * 0.92, ay = neckBaseY;
    const dist = Math.hypot(ax, ay - bailY);
    const M = Math.max(12, Math.round(dist / step));
    let last = { x: ax, y: ay };
    for (let i = 0; i <= M; i++) {
      const tt = i / M;
      const x = ax * (1 - tt);
      const droop = Math.sin(tt * Math.PI) * chainLen * 0.05; // 自然な垂れ
      const y = ay + (bailY - ay) * tt - droop;
      const ang = i === 0 ? Math.atan2(bailY - ay, -ax) : Math.atan2(y - last.y, x - last.x);
      placeLink(x, y, ang, i % 2, `chain-${side}-${i}`);
      last = { x, y };
    }
  }
  // バチカン接続リング
  const jr = new THREE.TorusGeometry(0.9, 0.2, 10, 24);
  jr.rotateX(Math.PI / 2);
  jr.translate(0, bailY, 0);
  parts.push({ id: 'chain-connector', geometry: jr, role: 'metal', componentType: 'bail' });
  return parts;
}

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

  // 内側くり抜き（オープンフレーム）: 正規化輪郭を w/h でスケールし穴として打ち抜く。
  // 穴は外形と逆巻き(Earcutが正しく抜く)に揃える。
  if (p.innerCutout && p.innerCutout.length >= 3) {
    const signedArea = (pts: { x: number; y: number }[]) => {
      let s = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y);
      return s;
    };
    const outerSign = Math.sign(signedArea(p.outline ?? p.innerCutout));
    let inner = p.innerCutout.map((pt) => ({ x: pt.x * p.width, y: pt.y * p.height }));
    if (Math.sign(signedArea(inner)) === outerSign) inner = inner.slice().reverse();
    const hole = new THREE.Path();
    inner.forEach((pt, i) => (i === 0 ? hole.moveTo(pt.x, pt.y) : hole.lineTo(pt.x, pt.y)));
    hole.closePath();
    shape.holes.push(hole);
  }

  const body = new THREE.ExtrudeGeometry(shape, {
    depth: p.thickness,
    bevelEnabled: true,
    bevelSize: Math.min(0.2, p.thickness * 0.13),
    bevelThickness: Math.min(0.2, p.thickness * 0.13),
    // カスタム外形(teardrop等)の解像度は outline 点数(208)で決まる。curveSegmentsは
    // disc/楕円など曲線シェイプ用なので適正値に（過剰だとtri数が爆発する）。
    bevelSegments: 14,
    curveSegments: 96,
  });
  body.translate(0, 0, -p.thickness / 2);
  body.computeVertexNormals();
  parts.push({ id: 'body', geometry: body, role: 'metal', componentType: 'body' });

  // 立体レリーフ（画像の陰影マップ→前面の隆起）。平板トレースを彫刻的フォルムへ。
  if (p.relief && p.relief.depth > 0) {
    const relief = buildReliefMesh(p);
    if (relief) parts.push({ id: 'relief', geometry: relief, role: 'metal', componentType: 'body' });
  }

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

    const seatZ = p.thickness / 2;
    if (st.setting === 'prong') {
      const prongs = makeProngs(st.diameter, st.diameter >= 5 ? 6 : 4);
      prongs.rotateX(Math.PI / 2); // 石と同じく前面(+Z)向きへ
      prongs.translate(st.position.x, st.position.y, seatZ);
      parts.push({ id: `prongs-${i}`, geometry: prongs, role: 'metal', componentType: 'prongs' });
    } else if (st.setting !== 'none' && st.setting !== 'flush') {
      // bezel / pave などは覆輪で受ける
      const bezel = makeBezel(st.diameter);
      bezel.rotateX(Math.PI / 2);
      bezel.translate(st.position.x, st.position.y, seatZ);
      parts.push({ id: `bezel-${i}`, geometry: bezel, role: 'metal', componentType: 'border' });
    }
  }

  // パヴェ留め: フレーム片側カーブに沿って小粒石を等間隔配置（光の線でなく粒として）
  if (p.pave && p.outline && p.outline.length >= 8) {
    const stones = buildPaveAlongOutline(p);
    for (const part of stones) parts.push(part);
  }

  // ネックレス全体（縦長オーバルのケーブルチェーン＋留め具/アジャスター/エンドタグ）。
  // ペンダントが最下部に吊り下がる“ネックレス全体”の構図。
  let chainRise = 0;
  if (design.category === 'necklace') {
    const { parts: chain, topY: chainTopY } = buildNecklaceLayout(bailConnectX, bailConnectY, p.width, p.height);
    for (const part of chain) parts.push(part);
    chainRise = chainTopY - bailConnectY + p.height / 2 + 2;
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

/**
 * 立体レリーフのメッシュ。前面(+Z)に高さマップでグリッド面を張る。
 * data[gj*gx+gi] が 0..1（外形マスク外は -1）。-1 のセルは面を張らない。
 * 巻き順は PlaneGeometry に倣い +Z 法線（フロント面が正しく光る）。
 */
function buildReliefMesh(p: PendantParams): THREE.BufferGeometry | null {
  const r = p.relief;
  if (!r) return null;
  const { gx, gy, data, depth } = r;
  const w = p.width;
  const h = p.height;
  const baseZ = p.thickness / 2 + 0.1; // 本体前面のわずか上に乗せる（z-fight回避）

  const positions = new Float32Array(gx * gy * 3);
  for (let gj = 0; gj < gy; gj++) {
    for (let gi = 0; gi < gx; gi++) {
      const k = gj * gx + gi;
      const hv = data[k];
      const x = -w / 2 + (gi / (gx - 1)) * w;
      const y = h / 2 - (gj / (gy - 1)) * h;
      const z = baseZ + (hv > 0 ? hv : 0) * depth;
      positions[k * 3] = x;
      positions[k * 3 + 1] = y;
      positions[k * 3 + 2] = z;
    }
  }

  const indices: number[] = [];
  for (let gj = 0; gj < gy - 1; gj++) {
    for (let gi = 0; gi < gx - 1; gi++) {
      const a = gi + gx * gj;
      const b = gi + gx * (gj + 1);
      const c = gi + 1 + gx * (gj + 1);
      const d = gi + 1 + gx * gj;
      // 4隅すべてがマスク内のセルのみ面を張る
      if (data[a] >= 0 && data[b] >= 0 && data[c] >= 0 && data[d] >= 0) {
        indices.push(a, b, d, b, c, d);
      }
    }
  }
  if (indices.length === 0) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** 楕円リンク（ケーブルチェーンの1コマ）。tangent方向に長い楕円トーラス。 */
function makeOvalLink(linkLen: number, linkWidth: number, wire: number): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry((linkLen + linkWidth) / 4, wire, 16, 32);
  g.scale(linkLen / linkWidth, 1, 1); // ローカルX(=後でtangent)に伸ばし楕円に
  return g;
}

/**
 * full_necklace_layout ジェネレーター。
 * ペンダント接続点(cx,cy)を最下部とする縦長オーバルのパス全周に、噛み合う楕円リンクを
 * 連続配置＝“ネックレス全体”。最上部に引き輪(clasp)・アジャスター・エンドタグ。
 * 戻り値: {parts, topY=オーバル最上部}。
 */
function buildNecklaceLayout(
  cx: number,
  cy: number,
  pendantW: number,
  pendantH: number
): { parts: BuiltPart[]; topY: number } {
  const parts: BuiltPart[] = [];
  const wire = 0.18;
  const linkLen = 1.9, linkWidth = 1.3;
  const step = linkLen * 0.42; // 噛み合うよう密に重ねる（リンク感を出す）

  const placeLink = (x: number, y: number, ang: number, parity: number, id: string) => {
    const link = makeOvalLink(linkLen, linkWidth, wire);
    const t = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0); // tangent
    const n = new THREE.Vector3(-Math.sin(ang), Math.cos(ang), 0);
    const up = new THREE.Vector3(0, 0, 1);
    const yAxis = parity === 0 ? up : n; // 偶奇でリンク面を90°切替＝噛み合い
    const zAxis = new THREE.Vector3().crossVectors(t, yAxis).normalize();
    link.applyMatrix4(new THREE.Matrix4().makeBasis(t, yAxis, zAxis));
    link.translate(x, y, 0);
    parts.push({ id, geometry: link, role: 'metal', componentType: 'bail' });
  };

  // ネックライン型ループ: 下=ペンダント接続点(cx,cy)、上に向かって広がり首元で開く“長いネックレス”。
  // 短い輪ではなく、首にかけて胸元にトップが落ちる自然な縦長シルエット。
  const chainLen = Math.max(pendantH * 2.6, 46); // 縦の長さ（首元→胸元）
  const halfW = Math.max(pendantW * 1.35, 18); // 首元の開きの半幅
  const arcBulge = halfW * 0.55; // 首の後ろ側カーブの膨らみ
  const topY = cy + chainLen;

  // 閉ループのパス（左辺 下→上 / 上アーク 左→右 / 右辺 上→下）
  const path: { x: number; y: number }[] = [];
  const SIDE = 90;
  for (let i = 0; i <= SIDE; i++) { const t = i / SIDE; path.push({ x: cx - halfW * Math.pow(t, 0.72), y: cy + chainLen * t }); }
  const arcN = 34;
  for (let i = 1; i < arcN; i++) { const a = Math.PI * (1 - i / arcN); path.push({ x: cx + halfW * Math.cos(a), y: topY + arcBulge * Math.sin(a) }); }
  for (let i = 0; i <= SIDE; i++) { const t = 1 - i / SIDE; path.push({ x: cx + halfW * Math.pow(t, 0.72), y: cy + chainLen * t }); }

  // 弧長で等間隔にリンク配置（最下部に小ギャップ＝ペンダント接続部）
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  const totalLen = cum[cum.length - 1];
  const gapLen = step * 1.6;
  let idx = 1, k = 0;
  for (let s = gapLen; s < totalLen - gapLen; s += step) {
    while (idx < cum.length && cum[idx] < s) idx++;
    const i0 = Math.max(1, idx);
    const A = path[i0 - 1], B = path[i0];
    const segLen = Math.max(1e-3, cum[i0] - cum[i0 - 1]);
    const tt = (s - cum[i0 - 1]) / segLen;
    const x = A.x + (B.x - A.x) * tt, y = A.y + (B.y - A.y) * tt;
    const ang = Math.atan2(B.y - A.y, B.x - A.x);
    placeLink(x, y, ang, k % 2, `chain-${k}`);
    k++;
  }

  // ペンダント接続のジャンプリング
  const jr = new THREE.TorusGeometry(1.0, 0.22, 10, 24);
  jr.rotateX(Math.PI / 2);
  jr.translate(cx, cy + 0.6, 0);
  parts.push({ id: 'chain-connector', geometry: jr, role: 'metal', componentType: 'bail' });

  const apexY = topY + arcBulge;

  // 丸カン（jump ring）: チェーン上端と留め具/アジャスターを繋ぐ小リング（省略しない）
  const jumpRing = (x: number, y: number, id: string) => {
    const g = new THREE.TorusGeometry(0.55, 0.13, 10, 24);
    g.rotateY(Math.PI / 2);
    g.translate(x, y, 0);
    parts.push({ id, geometry: g, role: 'metal', componentType: 'bail' });
  };
  jumpRing(cx - 0.5, apexY, 'jumpring-clasp');
  jumpRing(cx + 0.6, apexY, 'jumpring-ext');

  // 上部中央(首の後ろ): 引き輪(spring ring clasp)
  const ring = new THREE.TorusGeometry(1.3, 0.3, 14, 36, Math.PI * 1.7);
  ring.rotateY(Math.PI / 2);
  ring.translate(cx - 1.6, apexY + 0.2, 0);
  parts.push({ id: 'clasp', geometry: ring, role: 'metal', componentType: 'bail' });

  // アジャスター数コマ＋エンドタグ（上部やや右）
  for (let i = 0; i < 6; i++) placeLink(cx + 1.6, apexY + 0.2 + i * step, Math.PI / 2, i % 2, `extender-${i}`);
  const tag = new THREE.SphereGeometry(0.6, 18, 14);
  tag.scale(0.7, 1.15, 0.5);
  tag.translate(cx + 1.6, apexY + 0.2 + 6 * step + 0.5, 0);
  parts.push({ id: 'end-tag', geometry: tag, role: 'metal', componentType: 'bail' });

  return { parts, topY: apexY + 6 * step + 1 };
}

/**
 * パヴェ留めのパーツ列を生成する。
 * 外形outline(正規化)を w/h でmm化し、指定側のカーブ上に小粒石を弧長等間隔で並べ、
 * フレーム上に乗るよう少し内側へオフセット。石と石の間に留め粒(ビーズ)を置く。
 */
function buildPaveAlongOutline(p: PendantParams): BuiltPart[] {
  const out: BuiltPart[] = [];
  const pave = p.pave!;
  const pts = p.outline!.map((o) => ({ x: o.x * p.width, y: o.y * p.height }));
  const onSide = (x: number) =>
    pave.side === 'both' ? true : pave.side === 'left' ? x < -p.width * 0.04 : x > p.width * 0.04;
  // 指定側の連続点列を抽出（順序保持）
  const side = pts.filter((pt) => onSide(pt.x));
  if (side.length < 3) return out;
  // 弧長
  const cum = [0];
  for (let i = 1; i < side.length; i++) cum.push(cum[i - 1] + Math.hypot(side[i].x - side[i - 1].x, side[i].y - side[i - 1].y));
  const total = cum[cum.length - 1];
  if (total < pave.diameter) return out;
  const sampleAt = (s: number) => {
    let i = 1;
    while (i < cum.length && cum[i] < s) i++;
    const a = side[i - 1], b = side[Math.min(i, side.length - 1)];
    const seg = Math.max(1e-3, cum[Math.min(i, cum.length - 1)] - cum[i - 1]);
    const t = Math.max(0, Math.min(1, (s - cum[i - 1]) / seg));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  const frontZ = p.thickness / 2 + pave.diameter * 0.25; // 埋もれないよう前面に出す
  const inset = pave.diameter * 0.42; // フレーム上に乗せるため中心方向へ（控えめに）
  const n = Math.max(3, pave.count);
  const beadR = Math.max(0.12, pave.diameter * 0.25);
  let prev: { x: number; y: number } | null = null;
  for (let j = 0; j < n; j++) {
    const s = (j / (n - 1)) * total;
    const pt = sampleAt(s);
    const len = Math.hypot(pt.x, pt.y) || 1;
    const px = pt.x - (pt.x / len) * inset;
    const py = pt.y - (pt.y / len) * inset;
    const gem = makeGem(pave.diameter, 'round');
    gem.rotateX(Math.PI / 2);
    gem.translate(px, py, frontZ);
    out.push({ id: `pave-${j}`, geometry: gem, role: 'stone', color: pave.color });
    // 石と石の間に留め粒（ビーズ）
    if (prev) {
      const bead = new THREE.SphereGeometry(beadR, 8, 7);
      bead.translate((px + prev.x) / 2, (py + prev.y) / 2, frontZ);
      out.push({ id: `pave-bead-${j}`, geometry: bead, role: 'metal', componentType: 'border' });
    }
    prev = { x: px, y: py };
  }
  return out;
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
