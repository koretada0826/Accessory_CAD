'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useDesignStore } from '@/store/useDesignStore';

/**
 * 刻印（エングレービング）の3D表現。
 *
 * フォントファイル不要・日本語対応のため、canvasにテキストを描いた
 * テクスチャを面に貼る方式。
 *   - ペンダント: 前面(+Z)の平面に貼る
 *   - リング(signet/dome): 印台/ドームの上面(+Y)に水平に貼る
 *   - depth < 0（凹/deboss）: 暗い窪み風 / depth > 0（凸/emboss）: 明るい隆起風
 *
 * ※ これはプレビュー表現。製造用の厳密な凹凸は STEP生成側(CadQuery)で扱う。
 */
const FONT_FAMILY: Record<string, string> = {
  serif: 'Georgia, "Times New Roman", "Hiragino Mincho ProN", serif',
  sans: 'Helvetica, Arial, "Hiragino Kaku Gothic ProN", sans-serif',
  script: '"Snell Roundhand", "Brush Script MT", cursive',
};

export default function EngravingDecal() {
  const design = useDesignStore((s) => s.design);
  const p = design.params;

  // 刻印を載せる面（ペンダント前面 / リント印台・ドーム上面）を決める
  const placement = useMemo(() => {
    if (design.engraving.length === 0) return null;
    if (p.kind === 'pendant') {
      const bevel = Math.min(0.25, p.thickness * 0.15);
      return {
        faceW: p.width,
        faceH: p.height,
        // 本体前面はベベル分だけ前に出ているので、その上に乗せる
        position: [0, 0, p.thickness / 2 + bevel + 0.05] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        planeW: p.width,
        planeH: p.height,
      };
    }
    if (p.kind === 'ring' && (p.top.type === 'signet' || p.top.type === 'dome')) {
      const outerR = p.innerDiameter / 2 + p.bandThickness;
      const topFaceY = outerR - 0.4 + p.top.height;
      // ドームは曲面なので少し小さめ・少し浮かせて頂点付近に。印台は面いっぱい。
      const fit = p.top.type === 'dome' ? 0.6 : 0.82;
      return {
        faceW: p.top.width,
        faceH: p.top.length,
        position: [0, topFaceY + 0.06, 0] as [number, number, number],
        // 上面に水平配置。上(+Y)から見て前(+Z)方向が文字の下になるよう向ける
        rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
        planeW: p.top.width * fit,
        planeH: p.top.length * fit,
      };
    }
    return null;
  }, [design.engraving.length, p]);

  const engKey = JSON.stringify(design.engraving);

  const texture = useMemo(() => {
    if (!placement) return null;
    const { faceW, faceH } = placement;
    const CW = 768;
    const CH = Math.max(64, Math.round((CW * faceH) / Math.max(1, faceW)));
    const canvas = document.createElement('canvas');
    canvas.width = CW;
    canvas.height = CH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, CW, CH);

    for (const e of design.engraving) {
      const fontPx = Math.max(8, (e.size / faceH) * CH);
      ctx.font = `600 ${fontPx}px ${FONT_FAMILY[e.font] ?? FONT_FAMILY.serif}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const x = (0.5 + e.position.x / faceW) * CW;
      const y = (0.5 - e.position.y / faceH) * CH;
      const deboss = e.depth < 0;
      const off = Math.max(1, fontPx * 0.04);
      if (deboss) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillText(e.text, x, y + off);
        ctx.fillStyle = 'rgba(15,12,6,0.72)';
        ctx.fillText(e.text, x, y);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillText(e.text, x, y + off);
        ctx.fillStyle = 'rgba(255,250,235,0.6)';
        ctx.fillText(e.text, x, y);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement, engKey]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!placement || !texture) return null;

  return (
    <mesh position={placement.position} rotation={placement.rotation} renderOrder={2}>
      <planeGeometry args={[placement.planeW, placement.planeH]} />
      <meshStandardMaterial
        map={texture}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        roughness={0.6}
        metalness={0.2}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}
