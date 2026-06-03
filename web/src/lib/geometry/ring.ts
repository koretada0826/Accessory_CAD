import * as THREE from 'three';
import type { AccessoryDesign, RingParams } from '@/types/accessory';
import {
  BuiltModel,
  BuiltPart,
  ellipseProfile,
  knifeProfile,
  makeGem,
  rectProfile,
  sweepProfile,
} from './primitives';

/**
 * リングのパラメトリック生成。
 *   - シャンク（バンド）: 断面プロファイルを内径周りに掃引
 *   - トップ: signet（印台） / stone（石座+石） / dome
 *   - 石: prong/bezel に応じて配置
 */
export function buildRing(design: AccessoryDesign, p: RingParams): BuiltModel {
  const parts: BuiltPart[] = [];
  const innerR = p.innerDiameter / 2;
  const centerR = innerR + p.bandThickness / 2;
  const outerR = innerR + p.bandThickness;

  // --- シャンク（バンド） ---
  let profile: THREE.Vector2[];
  switch (p.profile) {
    case 'round':
      profile = ellipseProfile(p.bandThickness, p.bandWidth);
      break;
    case 'comfort':
      profile = rectProfile(p.bandThickness, p.bandWidth, Math.min(p.bandThickness, p.bandWidth) * 0.45);
      break;
    case 'knife':
      profile = knifeProfile(p.bandThickness, p.bandWidth);
      break;
    case 'flat':
    default:
      profile = rectProfile(p.bandThickness, p.bandWidth, 0.15);
      break;
  }
  const band = sweepProfile(profile, centerR, 180);
  parts.push({ id: 'shank', geometry: band, role: 'metal', componentType: 'shank' });

  // --- トップ（リング上部 +Y 方向に配置） ---
  const topBaseY = outerR; // バンド外周に着座
  if (p.top.type === 'signet' || p.top.type === 'dome') {
    let topGeo: THREE.BufferGeometry;
    if (p.top.type === 'dome') {
      topGeo = new THREE.SphereGeometry(p.top.width / 2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      topGeo.scale(1, p.top.height / (p.top.width / 2), p.top.length / p.top.width);
    } else {
      // 印台: 角丸プレート（押し出し）。footprint = width(X) x length(Z)
      const s = new THREE.Shape();
      const hw = p.top.width / 2;
      const hl = p.top.length / 2;
      const r = Math.min(hw, hl) * 0.35;
      s.moveTo(-hw + r, -hl);
      s.lineTo(hw - r, -hl);
      s.quadraticCurveTo(hw, -hl, hw, -hl + r);
      s.lineTo(hw, hl - r);
      s.quadraticCurveTo(hw, hl, hw - r, hl);
      s.lineTo(-hw + r, hl);
      s.quadraticCurveTo(-hw, hl, -hw, hl - r);
      s.lineTo(-hw, -hl + r);
      s.quadraticCurveTo(-hw, -hl, -hw + r, -hl);
      topGeo = new THREE.ExtrudeGeometry(s, { depth: p.top.height, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2, bevelSegments: 2 });
      // 押し出しはZ方向→Yに立てる
      topGeo.rotateX(-Math.PI / 2);
    }
    // 上部に移動（バンドにわずかにめり込ませて結合感を出す）
    topGeo.translate(0, topBaseY - 0.4, 0);
    parts.push({ id: 'top', geometry: topGeo, role: 'metal', componentType: 'top' });
  }

  // --- 石座 + 石（stone トップ または stones[] がある場合） ---
  const stones = design.stones;
  if (p.top.type === 'stone' || stones.length > 0) {
    const main = stones[0];
    const d = main?.diameter ?? Math.min(p.top.width, p.top.length, 5);
    const seatY = topBaseY + 0.2;

    // ベゼル/プロングの簡易表現
    if ((main?.setting ?? 'prong') === 'bezel') {
      const bezel = new THREE.CylinderGeometry(d / 2 + 0.6, d / 2 + 0.6, d * 0.45, 24);
      bezel.translate(0, seatY + d * 0.2, 0);
      parts.push({ id: 'bezel', geometry: bezel, role: 'metal', componentType: 'bezel' });
    } else {
      const prongs = 4;
      for (let i = 0; i < prongs; i++) {
        const a = (i / prongs) * Math.PI * 2 + Math.PI / 4;
        const prong = new THREE.CylinderGeometry(0.35, 0.45, d * 0.7, 8);
        prong.translate((d / 2) * Math.cos(a), seatY + d * 0.25, (d / 2) * Math.sin(a));
        parts.push({ id: `prong-${i}`, geometry: prong, role: 'metal', componentType: 'prongs' });
      }
    }

    // 石本体
    const gem = makeGem(d, main?.cut ?? 'round');
    gem.translate(0, seatY + d * 0.5, 0);
    parts.push({ id: 'stone-0', geometry: gem, role: 'stone', color: main?.color ?? '#bfe9ff' });

    // サイドストーン
    for (let i = 1; i < stones.length; i++) {
      const st = stones[i];
      const g = makeGem(st.diameter, st.cut);
      const offset = (i % 2 === 0 ? 1 : -1) * (d / 2 + st.diameter);
      g.translate(offset, seatY + st.diameter * 0.4, 0);
      parts.push({ id: `stone-${i}`, geometry: g, role: 'stone', color: st.color });
    }
  }

  return {
    parts,
    bounds: {
      width: outerR * 2,
      height: outerR * 2 + (p.top.type !== 'none' ? p.top.height + 2 : 0),
      depth: Math.max(p.bandWidth, p.top.length),
    },
  };
}
