'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useDesignStore } from '@/store/useDesignStore';

/**
 * 刻印（エングレービング）の3D表現。
 *
 * フォントファイル不要・日本語対応のため、canvasにテキストを描いた
 * テクスチャをペンダント前面の平面に貼る方式。
 *   - depth < 0（凹/deboss）: 暗い窪み風（上にハイライト・下に影）
 *   - depth > 0（凸/emboss）: 明るい隆起風
 * 透明部分は素材がそのまま見える。
 *
 * ※ これはプレビュー表現。製造用の厳密な凹凸は STEP生成側(CadQuery)で扱う想定。
 */
const FONT_FAMILY: Record<string, string> = {
  serif: 'Georgia, "Times New Roman", "Hiragino Mincho ProN", serif',
  sans: 'Helvetica, Arial, "Hiragino Kaku Gothic ProN", sans-serif',
  script: '"Snell Roundhand", "Brush Script MT", cursive',
};

export default function EngravingDecal() {
  const design = useDesignStore((s) => s.design);
  const p = design.params;

  const isPendant = p.kind === 'pendant';
  const width = isPendant ? p.width : 0;
  const height = isPendant ? p.height : 0;
  const thickness = isPendant ? p.thickness : 0;
  const engKey = JSON.stringify(design.engraving);

  const texture = useMemo(() => {
    if (!isPendant || design.engraving.length === 0) return null;
    const CW = 768;
    const CH = Math.max(64, Math.round((CW * height) / Math.max(1, width)));
    const canvas = document.createElement('canvas');
    canvas.width = CW;
    canvas.height = CH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, CW, CH);

    for (const e of design.engraving) {
      const fontPx = Math.max(8, (e.size / height) * CH);
      ctx.font = `600 ${fontPx}px ${FONT_FAMILY[e.font] ?? FONT_FAMILY.serif}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const x = (0.5 + e.position.x / width) * CW;
      const y = (0.5 - e.position.y / height) * CH;
      const deboss = e.depth < 0;
      const off = Math.max(1, fontPx * 0.04);
      if (deboss) {
        // 窪み風: 下にハイライト、本体は暗色
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillText(e.text, x, y + off);
        ctx.fillStyle = 'rgba(15,12,6,0.72)';
        ctx.fillText(e.text, x, y);
      } else {
        // 隆起風: 下に影、本体は明色
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
  }, [isPendant, width, height, engKey]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!isPendant || !texture) return null;

  // 本体前面はベベル分だけ前に出ているので、その上に乗せる
  const bevel = Math.min(0.25, thickness * 0.15);
  const z = thickness / 2 + bevel + 0.05;

  return (
    <mesh position={[0, 0, z]} renderOrder={2}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={texture}
        transparent
        depthWrite={false}
        roughness={0.6}
        metalness={0.2}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}
