import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import type { AccessoryDesign } from '@/types/accessory';
import { buildModel } from '@/lib/geometry';
import { MATERIALS } from '@/lib/data/materials';
import { buildShape, circleHole } from '@/lib/geometry/primitives';

export type ExportFormat = 'glb' | 'stl' | 'obj' | 'svg' | 'json' | 'step';

/** BuiltModel から THREE.Group を構築（エクスポート用、ライト無し） */
export function designToGroup(design: AccessoryDesign): THREE.Group {
  const group = new THREE.Group();
  const model = buildModel(design);
  const mat = MATERIALS[design.materialId];
  for (const part of model.parts) {
    const material =
      part.role === 'stone'
        ? new THREE.MeshStandardMaterial({ color: part.color ?? '#bfe9ff', metalness: 0.1, roughness: 0.05 })
        : new THREE.MeshStandardMaterial({ color: mat.color, metalness: 1, roughness: mat.roughness });
    group.add(new THREE.Mesh(part.geometry, material));
  }
  return group;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safeName = (d: AccessoryDesign) => (d.name || 'accessory').replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g, '_');

/** STL（3Dプリント/原型の標準フォーマット） */
export function exportSTL(design: AccessoryDesign) {
  const group = designToGroup(design);
  const out = new STLExporter().parse(group, { binary: false });
  download(new Blob([out], { type: 'model/stl' }), `${safeName(design)}.stl`);
}

/** OBJ */
export function exportOBJ(design: AccessoryDesign) {
  const group = designToGroup(design);
  const out = new OBJExporter().parse(group);
  download(new Blob([out], { type: 'text/plain' }), `${safeName(design)}.obj`);
}

/** GLB（Web/AR用バイナリ glTF） */
export function exportGLB(design: AccessoryDesign): Promise<void> {
  const group = designToGroup(design);
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      group,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
        download(blob, `${safeName(design)}.glb`);
        resolve();
      },
      (err) => reject(err),
      { binary: true }
    );
  });
}

/** SVG（2D外形）— 現状はペンダント外形を出力。CAM/レーザー下絵用 */
export function exportSVG(design: AccessoryDesign) {
  const p = design.params;
  let pathPoints: { x: number; y: number }[] = [];
  let w = 40,
    h = 40;
  if (p.kind === 'pendant') {
    const shape = buildShape(p.shape, p.width, p.height, p.cornerRadius);
    pathPoints = shape.getPoints(80).map((v) => ({ x: v.x, y: -v.y }));
    w = p.width;
    h = p.height;
  } else if (p.kind === 'ring') {
    const R = p.innerDiameter / 2 + p.bandThickness;
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pathPoints.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
    }
    w = R * 2;
    h = R * 2;
  } else {
    pathPoints = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ];
  }
  const pad = 4;
  const d = pathPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'}${(pt.x + w / 2 + pad).toFixed(2)},${(pt.y + h / 2 + pad).toFixed(2)}`).join(' ') + ' Z';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${(w + pad * 2)}mm" height="${(h + pad * 2)}mm" viewBox="0 0 ${w + pad * 2} ${h + pad * 2}">
  <path d="${d}" fill="none" stroke="#000" stroke-width="0.2"/>
</svg>`;
  download(new Blob([svg], { type: 'image/svg+xml' }), `${safeName(design)}.svg`);
}

/** 3Dビューのスクリーンショット（PNG）。共有・提案・SNS用 */
export function exportPNG(design: AccessoryDesign) {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('3Dビューが見つかりません');
  const url = canvas.toDataURL('image/png');
  if (!url || url.length < 1000) throw new Error('画像の取得に失敗しました（ビューを一度操作してから再試行してください）');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(design)}.png`;
  a.click();
}

/** 構造JSON（プロジェクト保存・再読込・共有用） */
export function exportJSON(design: AccessoryDesign) {
  download(new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' }), `${safeName(design)}.json`);
}

/**
 * STEP（厳密ソリッド）。ブラウザ単体では生成不可。
 * backend(/export/step, CadQuery/OCC) に構造JSONを渡して生成する想定。
 * 現状は backend 未接続のため、接続前提のスタブ。
 */
export async function exportSTEP(design: AccessoryDesign, apiBase?: string): Promise<void> {
  const base = apiBase ?? process.env.NEXT_PUBLIC_API_BASE;
  if (!base) {
    throw new Error('STEP出力には backend(API) が必要です。NEXT_PUBLIC_API_BASE を設定してください。');
  }
  const res = await fetch(`${base}/export/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(design),
  });
  if (!res.ok) throw new Error(`STEP生成に失敗しました (${res.status})`);
  const blob = await res.blob();
  download(blob, `${safeName(design)}.step`);
}
