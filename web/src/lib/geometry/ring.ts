import * as THREE from 'three';
import type { AccessoryDesign, RingParams } from '@/types/accessory';
import {
  BuiltModel,
  BuiltPart,
  ellipseProfile,
  knifeProfile,
  makeBezel,
  makeGem,
  makeMilgrain,
  makeProngs,
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
  const band = sweepProfile(profile, centerR, 220);
  parts.push({ id: 'shank', geometry: band, role: 'metal', componentType: 'shank' });

  // ミル打ち（高級仕上げ）: バンド両縁の外周に粒飾りを回す
  if (p.milgrain) {
    const bR = Math.min(0.22, p.bandWidth * 0.12);
    for (const z of [p.bandWidth / 2 - bR * 0.4, -p.bandWidth / 2 + bR * 0.4]) {
      const mil = makeMilgrain(outerR - bR * 0.3, z, bR);
      parts.push({ id: `milgrain-${z > 0 ? 'a' : 'b'}`, geometry: mil, role: 'metal', componentType: 'shank' });
    }
  }

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

    const setting = main?.setting ?? 'prong';
    // 覆輪 / 先玉付き絞り爪（精密化した石座）
    if (setting === 'bezel') {
      const bezel = makeBezel(d);
      bezel.translate(0, seatY + d * 0.12, 0);
      parts.push({ id: 'bezel', geometry: bezel, role: 'metal', componentType: 'bezel' });
      if (p.milgrain) {
        const mil = makeMilgrain(d / 2 + 0.5, 0, 0.18);
        mil.rotateX(Math.PI / 2); // 軸を+Yへ
        mil.translate(0, seatY + d * 0.32, 0);
        parts.push({ id: 'bezel-milgrain', geometry: mil, role: 'metal', componentType: 'bezel' });
      }
    } else {
      const prongs = makeProngs(d, d >= 5 ? 6 : 4);
      prongs.translate(0, seatY + d * 0.12, 0);
      parts.push({ id: 'prongs', geometry: prongs, role: 'metal', componentType: 'prongs' });
    }

    // --- ギャラリー（石座下の精密化）: アンダーベゼル・レール + ガラリー・ワイヤー ---
    // 石のガードル直下に細い輪（アンダーベゼル）を回し、座とバンドを数本のワイヤーで繋ぐ。
    {
      const railR = d / 2 + (setting === 'bezel' ? 0.55 : 0.25);
      const railY = seatY + d * 0.05;
      const rail = new THREE.TorusGeometry(railR, 0.22, 10, 28);
      rail.rotateX(Math.PI / 2); // リング面を水平（XZ）に
      rail.translate(0, railY, 0);
      parts.push({ id: 'gallery-rail', geometry: rail, role: 'metal', componentType: 'gallery' });

      // 座→バンド上端を繋ぐワイヤー（前後左右の4本）
      const wireTop = railY;
      const wireBot = topBaseY - 0.2;
      const wh = Math.max(0.4, wireTop - wireBot);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const wire = new THREE.CylinderGeometry(0.2, 0.24, wh, 6);
        wire.translate(railR * 0.8 * Math.cos(a), (wireTop + wireBot) / 2, railR * 0.8 * Math.sin(a));
        parts.push({ id: `gallery-wire-${i}`, geometry: wire, role: 'metal', componentType: 'gallery' });
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

    // --- メレ（ショルダーのパヴェ留め）: ソリティア時のみ、両肩に小石を配置 ---
    // バンド上部の弧に沿って外面へ小石を埋め込み、ビーズ状の小さな爪で留める。
    if (stones.length <= 1 && d >= 2.6) {
      const angles = [18, 33, 48]; // 度: 天頂(+Y)からの開き
      const color = main?.color ?? '#dfe9f5';
      angles.forEach((deg, k) => {
        const th = (deg * Math.PI) / 180;
        const md = Math.max(0.8, d * (0.24 - k * 0.045)); // 上ほど大きく
        for (const s of [-1, 1]) {
          const sx = Math.sin(th) * s;
          const cy = Math.cos(th);
          const r = outerR + md * 0.15; // バンド外面にわずかに乗せる
          const mg = makeGem(md, 'round');
          mg.translate(sx * r, cy * r, 0);
          parts.push({ id: `melee-${k}-${s > 0 ? 'r' : 'l'}`, geometry: mg, role: 'stone', color });
          // ビーズ爪（小さな金属球）を石の左右に
          for (const bs of [-1, 1]) {
            const bead = new THREE.SphereGeometry(0.22, 6, 6);
            const bx = sx * r + bs * md * 0.5 * Math.cos(th);
            const by = cy * r - bs * md * 0.5 * Math.sin(th) * s;
            bead.translate(bx, by, md * 0.25);
            parts.push({ id: `melee-bead-${k}-${s}-${bs}`, geometry: bead, role: 'metal', componentType: 'prongs' });
          }
        }
      });
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
