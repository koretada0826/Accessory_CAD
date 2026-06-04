'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Grid, Html, GizmoHelper, GizmoViewcube, MeshReflectorMaterial } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, DepthOfField, SMAA } from '@react-three/postprocessing';
// 実写HDRIをローカル同梱（CDN非依存・オフライン可）
import studioHdri from '@pmndrs/assets/hdri/studio.exr';
import * as THREE from 'three';
import { useDesignStore } from '@/store/useDesignStore';
import { buildModel } from '@/lib/geometry';
import { MATERIALS } from '@/lib/data/materials';
import EngravingDecal from './EngravingDecal';

type ViewPreset = 'persp' | 'front' | 'side' | 'back' | 'top';

/**
 * 金属の微細な反射差用の手続きノイズ（roughnessMap）。
 * 低解像度の滑らかな斑＝面ごとに僅かに荒さが変わり、均一なCG反射を脱して
 * 鋳造研磨された本物の金属らしい“揺らぎ”を与える。
 */
function makeMicroRoughTexture(): THREE.Texture {
  const N = 64;
  const data = new Uint8Array(N * N * 4);
  // 滑らかにするため2x2の値を平均しつつ、中央値高め(=研磨寄り)の斑に
  const base = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) base[i] = Math.random();
  const sm = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = (x + dx + N) % N, yy = (y + dy + N) % N;
          s += base[yy * N + xx]; c++;
        }
      sm[y * N + x] = s / c;
    }
  }
  for (let i = 0; i < N * N; i++) {
    // 0.78〜1.0 の範囲（roughnessに乗算＝僅かな変動）
    const r = Math.round((0.78 + sm[i] * 0.22) * 255);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = r;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** 構造JSON → メッシュ群。選択パーツをハイライト */
function AccessoryMeshes({ wireframe }: { wireframe: boolean }) {
  const design = useDesignStore((s) => s.design);
  const selectedId = useDesignStore((s) => s.selectedComponentId);
  const components = design.components;
  const selectComponent = useDesignStore((s) => s.selectComponent);
  const moveStone = useDesignStore((s) => s.moveStone);
  const moveHole = useDesignStore((s) => s.moveHole);
  const controls = useThree((s) => s.controls) as any;

  // 石/穴ドラッグ（ペンダントのみ）
  const [drag, setDrag] = useState<{ kind: 'stone' | 'hole'; index: number; z: number } | null>(null);
  const firstMove = useRef(true);
  const params = design.params;
  const isPendant = params.kind === 'pendant';
  const pw = params.kind === 'pendant' ? params.width : 0;
  const ph = params.kind === 'pendant' ? params.height : 0;
  const pt = params.kind === 'pendant' ? params.thickness : 0;

  const { model, mat, patternRoughness } = useMemo(() => {
    const model = buildModel(design);
    const mat = MATERIALS[design.materialId];
    const pat = design.patterns[0];
    let patternRoughness = mat.roughness;
    if (pat) {
      if (pat.type === 'hammered') patternRoughness = 0.4 + pat.intensity * 0.2;
      else if (pat.type === 'brushed') patternRoughness = 0.5 + pat.intensity * 0.25;
      else if (pat.type === 'gothic') patternRoughness = 0.45;
    } else if (mat.metalness > 0.5) {
      // 上品で深い反射: 鏡面すぎず(=安っぽくテカらない)、白飛びしない研磨
      patternRoughness = Math.max(0.11, mat.roughness * 0.62);
    }
    return { model, mat, patternRoughness };
  }, [design]);

  // 金属の微細な反射差テクスチャ（一度だけ生成し全金属で共有）
  const microRough = useMemo(() => {
    const t = makeMicroRoughTexture();
    t.repeat.set(5, 2.5);
    return t;
  }, []);
  useEffect(() => () => microRough.dispose(), [microRough]);

  // 選択中 component の type（ハイライト対象）
  const selectedType = components.find((c) => c.id === selectedId)?.type;

  const endDrag = () => {
    setDrag(null);
    if (controls) controls.enabled = true;
    document.body.style.cursor = 'auto';
  };

  return (
    <group rotation={[0, 0, 0]}>
      {model.parts.map((part) => {
        const comp = components.find((c) => c.type === part.componentType);
        const visible = comp ? comp.visible : true;
        if (!visible) return null;
        const highlighted = !!part.componentType && part.componentType === selectedType;

        if (part.role === 'stone') {
          // 色の明度から石の性質を推定: 明るい=ダイヤ(高透過＋分散)、暗い=オニキス等(低透過・艶)
          const col = new THREE.Color(part.color ?? '#eef6ff');
          const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
          const bright = lum > 0.55;
          const transmission = bright ? 1.0 : lum > 0.2 ? 0.72 : 0.22;
          return (
            <mesh key={part.id} geometry={part.geometry}>
              <meshPhysicalMaterial
                color={part.color ?? '#eef6ff'}
                metalness={0}
                roughness={0}
                transmission={transmission}
                thickness={2.4}
                ior={2.42}
                // 分散（ファイア）でダイヤらしい色の煌めき。発光ではなく屈折で輝かせる
                dispersion={bright ? 0.32 : 0.06}
                attenuationColor={part.color ?? '#ffffff'}
                attenuationDistance={bright ? 8 : 1.6}
                specularIntensity={1}
                envMapIntensity={1.15}
                side={THREE.DoubleSide}
                wireframe={wireframe}
              />
            </mesh>
          );
        }
        return (
          <mesh
            key={part.id}
            geometry={part.geometry}
            onClick={(e) => {
              e.stopPropagation();
              if (comp) selectComponent(comp.id);
            }}
          >
            <meshPhysicalMaterial
              color={highlighted ? new THREE.Color(mat.color).lerp(new THREE.Color('#ffffff'), 0.15) : mat.color}
              metalness={mat.metalness}
              roughness={patternRoughness}
              // 微細な反射差（均一CG反射を脱して本物の金属らしい揺らぎ）
              roughnessMap={mat.metalness > 0.5 ? microRough : undefined}
              // 実写HDRIに合わせ、映り込みは豊かだが白飛びしない上品な強度に
              clearcoat={mat.metalness > 0.5 ? 0.38 : 0}
              clearcoatRoughness={0.14}
              reflectivity={0.55}
              envMapIntensity={mat.metalness > 0.5 ? 1.55 : 1.1}
              emissive={highlighted ? new THREE.Color('#e6c068') : new THREE.Color('#000000')}
              emissiveIntensity={highlighted ? 0.25 : 0}
              wireframe={wireframe}
            />
          </mesh>
        );
      })}

      {/* 石のドラッグ用 透明グラブハンドル（ペンダントのみ・宝石より大きめで掴みやすい） */}
      {isPendant &&
        design.stones.map((st, i) => {
          const z = pt / 2 + st.diameter * 0.15;
          const r = Math.max(st.diameter * 0.75, 2.2);
          return (
            <mesh
              key={`grab-${i}`}
              position={[st.position.x, st.position.y, z]}
              onPointerOver={() => { document.body.style.cursor = 'grab'; }}
              onPointerOut={() => { if (!drag) document.body.style.cursor = 'auto'; }}
              onPointerDown={(e) => {
                e.stopPropagation();
                firstMove.current = true;
                setDrag({ kind: 'stone', index: i, z });
                if (controls) controls.enabled = false;
                document.body.style.cursor = 'grabbing';
              }}
            >
              <sphereGeometry args={[r, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          );
        })}

      {/* 穴のドラッグ用 透明グラブハンドル（ペンダントのみ・吊り穴=bailは固定、装飾/機能穴のみ可動） */}
      {isPendant &&
        design.holes.map((h, i) =>
          h.role === 'bail' ? null : (
            <mesh
              key={`hole-grab-${i}`}
              position={[h.position.x, h.position.y, pt / 2 + 0.6]}
              onPointerOver={() => { document.body.style.cursor = 'grab'; }}
              onPointerOut={() => { if (!drag) document.body.style.cursor = 'auto'; }}
              onPointerDown={(e) => {
                e.stopPropagation();
                firstMove.current = true;
                setDrag({ kind: 'hole', index: i, z: pt / 2 + 0.6 });
                if (controls) controls.enabled = false;
                document.body.style.cursor = 'grabbing';
              }}
            >
              <sphereGeometry args={[Math.max(h.diameter * 0.7, 2), 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          ),
        )}

      {/* 石ドラッグ用の透明キャッチャー（ドラッグ中のみ）。広い平面で確実にmoveを拾う */}
      {drag && (
        <mesh
          position={[0, 0, drag.z]}
          onPointerMove={(e) => {
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -drag.z);
            const hit = new THREE.Vector3();
            if (e.ray.intersectPlane(plane, hit)) {
              const x = Math.max(-pw / 2 * 0.92, Math.min(pw / 2 * 0.92, hit.x));
              const y = Math.max(-ph / 2 * 0.92, Math.min(ph / 2 * 0.92, hit.y));
              const rx = Math.round(x * 10) / 10;
              const ry = Math.round(y * 10) / 10;
              if (drag.kind === 'stone') moveStone(drag.index, rx, ry, firstMove.current);
              else moveHole(drag.index, rx, ry, firstMove.current);
              firstMove.current = false;
            }
          }}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          <planeGeometry args={[600, 600]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      <EngravingDecal />
    </group>
  );
}

/** カメラを bounds に合わせて初期化 & ビュー切替 */
function CameraRig({ preset, presetNonce, focus }: { preset: ViewPreset; presetNonce: number; focus: 'full' | 'pendant' }) {
  const design = useDesignStore((s) => s.design);
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as any;

  const { center, fullDim, pendantDim } = useMemo(() => {
    const model = buildModel(design);
    const box = new THREE.Box3();
    for (const part of model.parts) {
      part.geometry.computeBoundingBox();
      if (part.geometry.boundingBox) box.union(part.geometry.boundingBox);
    }
    const c = new THREE.Vector3();
    const size = new THREE.Vector3();
    if (!box.isEmpty()) { box.getCenter(c); box.getSize(size); }
    const fd = Math.max(size.x, size.y, size.z, 8);
    const p = design.params;
    const pd = p.kind === 'pendant' ? Math.max(p.width, p.height, 8) : fd;
    return { center: c, fullDim: fd, pendantDim: pd };
  }, [design]);

  useEffect(() => {
    const usePendant = focus === 'pendant';
    const target = usePendant ? new THREE.Vector3(0, 0, 0) : center; // ペンダントは原点
    const d = (usePendant ? pendantDim : fullDim) * (usePendant ? 2.3 : 2.05);
    const pos: Record<ViewPreset, [number, number, number]> = {
      persp: [target.x + d * 0.62, target.y + d * 0.48, target.z + d * 0.92],
      front: [target.x, target.y, target.z + d],
      side: [target.x + d, target.y, target.z + 0.0001],
      back: [target.x, target.y, target.z - d],
      top: [target.x, target.y + d, target.z + 0.0001],
    };
    camera.position.set(...pos[preset]);
    camera.lookAt(target);
    (camera as THREE.PerspectiveCamera).near = 0.1;
    (camera as THREE.PerspectiveCamera).far = (fullDim + d) * 10;
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, presetNonce, focus, center, fullDim, pendantDim]);

  return null;
}

/**
 * マネキン（首・肩・胸のバスト）を手続き生成し、ネックレスを着用しているように見せる。
 * 汎用着用ルーター: 現状は neck（ネックレス/ペンダント）に対応。
 * ネックレスは原点(ペンダント)から上にチェーンが伸びる前提で、首の開口に合わせて配置。
 */
/**
 * 着用プレビュー用の人体バスト（首・肩・胸・頭）を手続き生成。
 * style=mannequin: 白いジュエリーマネキン / model: 肌色の人物モデル(頭付き)。
 * ネックレスは原点(ペンダント=胸元)から上にチェーンが伸びる前提で、首・胸に沿わせる。
 */
function MannequinBust({ style }: { style: 'mannequin' | 'model' }) {
  const design = useDesignStore((s) => s.design);
  const p = design.params;
  if (p.kind !== 'pendant') return null;
  const pendH = p.height, pendW = p.width;
  const chainLen = Math.max(pendH * 2.6, 46);
  const halfW = Math.max(pendW * 1.35, 18);
  const neckR = halfW * 0.58;
  const model = style === 'model';
  const mat = { color: model ? '#d7a98a' : '#d4cfc5', roughness: model ? 0.62 : 0.82, metalness: 0 } as const;
  // 胴体を後ろへ。胸の前面が z≈-1（ネックレス面のすぐ後ろ）に来るように
  const zback = -neckR * 1.25;
  return (
    <group position={[0, 0, zback]}>
      {/* 胸〜胴（下半身側を広く、上半身デコルテ） */}
      <mesh position={[0, chainLen * 0.26, -neckR * 0.45]} scale={[halfW * 2.35, chainLen * 0.95, neckR * 1.7]} castShadow receiveShadow>
        <sphereGeometry args={[1, 64, 44, 0, Math.PI * 2, 0, Math.PI * 0.72]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* 左右の肩 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * halfW * 1.28, chainLen * 0.6, -neckR * 0.5]} scale={[halfW * 0.95, neckR * 1.5, neckR * 1.5]} castShadow receiveShadow>
          <sphereGeometry args={[1, 36, 28]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      ))}
      {/* 首 */}
      <mesh position={[0, chainLen * 0.84, -neckR * 0.1]} castShadow receiveShadow>
        <cylinderGeometry args={[neckR * 0.82, neckR * 1.0, chainLen * 0.55, 48, 1]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* 頭（モデルのみ） */}
      {model && (
        <mesh position={[0, chainLen * 1.2, -neckR * 0.1]} scale={[neckR * 1.15, neckR * 1.45, neckR * 1.2]} castShadow receiveShadow>
          <sphereGeometry args={[1, 48, 40]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      )}
    </group>
  );
}

function DimensionLabel() {
  const design = useDesignStore((s) => s.design);
  const b = useMemo(() => buildModel(design).bounds, [design]);
  return (
    <Html position={[0, 0, 0]} center wrapperClass="pointer-events-none">
      <div className="-translate-y-24 whitespace-nowrap rounded-md bg-ink-900/80 px-2 py-1 text-[10px] text-gold-400 ring-1 ring-ink-700">
        {b.width.toFixed(1)} × {b.height.toFixed(1)} × {b.depth.toFixed(1)} mm
      </div>
    </Html>
  );
}

export default function Viewer() {
  // 表示モード: hero=広告レンダー / edit=編集 / wear=マネキン着用プレビュー
  const [view, setView2] = useState<'hero' | 'edit' | 'wear'>('hero');
  const [focus, setFocus] = useState<'full' | 'pendant'>('full');
  const [wearStyle, setWearStyle] = useState<'mannequin' | 'model'>('model');
  const [wireframe, setWireframe] = useState(false);
  const [grid, setGrid] = useState(false);
  const [dims, setDims] = useState(false);
  const [preset, setPreset] = useState<ViewPreset>('persp');
  const [nonce, setNonce] = useState(0);
  const [spin, setSpin] = useState(false);
  const hero = view !== 'edit'; // hero / wear は高品質レンダー、edit はくっきり編集
  const wearing = view === 'wear';

  // R3F は flexbox 内で初回サイズを 0 と測定し、GLルート生成を遅延することがある
  // （ResizeObserver の初回コールバックが取りこぼされるケース）。
  // R3F の計測リスナ設定後に resize を数回発火させ、確実に初期化させる。
  useEffect(() => {
    const fire = () => window.dispatchEvent(new Event('resize'));
    const timers = [60, 200, 500].map((ms) => setTimeout(fire, ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  const setView = (p: ViewPreset) => {
    setPreset(p);
    setNonce((n) => n + 1);
  };

  const Btn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) => (
    <button
      onClick={onClick}
      title={title}
      className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1 text-xs transition-all duration-200 ${
        active ? 'bg-ink-800 font-medium text-gold-400 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]' : 'text-ink-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="relative h-full w-full">
      {/* 表示モード切替。中央ツールバーと衝突しないよう左上に縦積み（2段目はサブ操作） */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col items-start gap-2">
        <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-ink-700/70 p-1 shadow-panel">
          <Btn active={view === 'edit'} onClick={() => setView2('edit')} title="編集ビュー（グリッド・寸法・くっきり表示）">編集</Btn>
          <Btn active={view === 'hero'} onClick={() => setView2('hero')} title="ヒーローレンダー（広告のような高画質）">ヒーロー</Btn>
          <Btn active={view === 'wear'} onClick={() => setView2('wear')} title="着用プレビュー（マネキン / モデル）">着用</Btn>
        </div>
        {view === 'hero' && (
          <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-ink-700/70 p-1 shadow-panel">
            <Btn active={focus === 'full'} onClick={() => setFocus('full')} title="ネックレス全体">全体</Btn>
            <Btn active={focus === 'pendant'} onClick={() => setFocus('pendant')} title="ペンダント寄り">寄り</Btn>
          </div>
        )}
        {view === 'wear' && (
          <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-ink-700/70 p-1 shadow-panel">
            <Btn active={wearStyle === 'mannequin'} onClick={() => setWearStyle('mannequin')} title="ジュエリーマネキン">マネキン</Btn>
            <Btn active={wearStyle === 'model'} onClick={() => setWearStyle('model')} title="人物モデル着用">モデル</Btn>
          </div>
        )}
      </div>

      {/* ビュー操作ツールバー（視点プリセット / 表示トグル） */}
      <div className="glass pointer-events-auto absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-ink-700/70 p-1.5 shadow-panel">
        <span className="hidden pl-1.5 pr-1 text-[9px] uppercase tracking-luxe text-ink-500 sm:inline">視点</span>
        <Btn active={preset === 'persp'} onClick={() => setView('persp')} title="透視投影（自由視点）">透視</Btn>
        <Btn active={preset === 'front'} onClick={() => setView('front')} title="正面から">正面</Btn>
        <Btn active={preset === 'side'} onClick={() => setView('side')} title="側面から">側面</Btn>
        <Btn active={preset === 'back'} onClick={() => setView('back')} title="背面から">背面</Btn>
        <Btn active={preset === 'top'} onClick={() => setView('top')} title="真上から">上面</Btn>
        <div className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
        <span className="hidden pl-1.5 pr-1 text-[9px] uppercase tracking-luxe text-ink-500 sm:inline">表示</span>
        <Btn active={wireframe} onClick={() => setWireframe((v) => !v)} title="ワイヤーフレーム表示">ワイヤー</Btn>
        <Btn active={grid} onClick={() => setGrid((v) => !v)} title="床グリッドの表示">グリッド</Btn>
        <Btn active={dims} onClick={() => setDims((v) => !v)} title="寸法線の表示（幅・高さ・厚み）">寸法</Btn>
        <Btn active={spin} onClick={() => setSpin((v) => !v)} title="自動回転のオン/オフ">自動回転</Btn>
      </div>

      <Canvas
        shadows
        camera={{ fov: 30, position: [22, 16, 32] }}
        dpr={[2, 2.5]}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.94 }}
        resize={{ debounce: 0, scroll: false }}
        onCreated={(state) => state.gl.render(state.scene, state.camera)}
        onPointerMissed={() => useDesignStore.getState().selectComponent(null)}
      >
        <color attach="background" args={['#070709']} />
        {/* スタジオ3灯（キー/フィル/リム）で立体と接地を作る。主たる映り込みはHDRI側 */}
        <ambientLight intensity={0.18} />
        <directionalLight position={[14, 22, 16]} intensity={0.9} color="#fff3df" castShadow shadow-mapSize-width={4096} shadow-mapSize-height={4096} shadow-bias={-0.0002} />
        <directionalLight position={[-16, 8, -6]} intensity={0.4} color="#aec0e8" />
        <directionalLight position={[0, 6, -18]} intensity={0.7} color="#fff" />

        {/* 実写HDRIスタジオ環境マップ（ジュエリー広告のような豊かな映り込み）。
            手続き光より自然な階調・空気感。サスペンド時はフォールバックで暗転させない。 */}
        <Suspense fallback={null}>
          <Environment files={studioHdri as string} environmentIntensity={0.95} resolution={2048} />
        </Suspense>

        <CameraRig preset={preset} presetNonce={nonce} focus={wearing ? 'full' : focus} />
        <AccessoryMeshes wireframe={wireframe} />
        {wearing && <MannequinBust style={wearStyle} />}
        {dims && <DimensionLabel />}

        {/* 反射フロア（製品写真風の艶のある黒床に作品が映り込む。ヒーロー時のみ） */}
        {hero && !grid && !wearing && (
          <mesh position={[0, -12.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[400, 400]} />
            <MeshReflectorMaterial
              resolution={1024}
              mirror={0.35}
              blur={[400, 140]}
              mixBlur={1.4}
              mixStrength={1.4}
              roughness={0.95}
              depthScale={1.2}
              minDepthThreshold={0.5}
              maxDepthThreshold={1.4}
              color="#08080d"
              metalness={0.4}
            />
          </mesh>
        )}
        <ContactShadows position={[0, -11.95, 0]} opacity={0.5} scale={70} blur={2.4} far={26} resolution={1024} color="#000000" />
        {grid && (
          <Grid
            position={[0, -12, 0]}
            args={[200, 200]}
            cellSize={5}
            cellThickness={0.5}
            cellColor="#26263a"
            sectionSize={25}
            sectionThickness={1}
            sectionColor="#3a3a5a"
            fadeDistance={160}
            fadeStrength={1}
            infiniteGrid
          />
        )}

        {/* 全方位オービット（上下も含め360°自由に見渡せる）+ 自動回転 */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.1}
          minDistance={5}
          maxDistance={400}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          autoRotate={spin}
          autoRotateSpeed={1.6}
        />

        {/* Blender風 ビューキューブ（面/辺/角をクリックでその視点へスナップ） */}
        <GizmoHelper alignment="top-right" margin={[70, 86]}>
          <GizmoViewcube
            color="#1b1b27"
            textColor="#e6c068"
            strokeColor="#3a3a5a"
            hoverColor="#e6c068"
          />
        </GizmoHelper>

        {/* 後処理。ヒーロー=広告風(被写界深度＋Bloom＋周辺減光)、編集=くっきり(軽いBloomのみ) */}
        {!wireframe && hero && (
          <EffectComposer multisampling={8}>
            {/* DoFは被写体をぼかさない極浅め（背景にだけ僅かな奥行き）。シャープさ優先 */}
            <DepthOfField target={[0, 0, 0]} focalLength={0.07} bokehScale={1.1} height={768} />
            <Bloom mipmapBlur intensity={0.09} luminanceThreshold={0.97} luminanceSmoothing={0.08} radius={0.4} />
            <Vignette offset={0.32} darkness={0.52} eskil={false} />
            <SMAA />
          </EffectComposer>
        )}
        {!wireframe && !hero && (
          <EffectComposer multisampling={8}>
            <Bloom mipmapBlur intensity={0.08} luminanceThreshold={0.97} luminanceSmoothing={0.08} radius={0.35} />
            <SMAA />
          </EffectComposer>
        )}
      </Canvas>

      <ContextTip />

      {/* シネマティックな縁取り（作品を中央に浮かび上がらせる） */}
      <div className="pointer-events-none absolute inset-0 z-[5] [box-shadow:inset_0_0_140px_40px_rgba(0,0,0,0.55)]" />

      {/* ブランド透かし（SNS/TikTokのフレームでも成立する） */}
      <div className="pointer-events-none absolute bottom-3 left-4 z-10 font-display text-sm tracking-wide text-white/20">Atelier</div>

      <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-lg bg-ink-950/40 px-2.5 py-1 text-[10px] text-ink-500 backdrop-blur-sm">
        ドラッグ=回転 / ホイール=ズーム / 右ドラッグ=パン
      </div>
    </div>
  );
}

/** 状況に応じた使い方ヒント（初心者向け・押し付けない短い一言） */
function ContextTip() {
  const design = useDesignStore((s) => s.design);
  const p = design.params;
  let tip: string;
  if (p.kind === 'pendant') {
    const draggable = design.stones.length > 0 || design.holes.some((h) => h.role !== 'bail');
    tip = draggable
      ? '石・装飾穴はドラッグで動かせます。チャットで「石を大きく」もOK'
      : '右で形・厚み・刻印を調整。チャットで「ルビーを入れて」もOK';
  } else if (p.kind === 'ring') {
    tip = '右で号数・断面・トップを調整。チャットで「13号にして」もOK';
  } else if (p.kind === 'earrings') {
    tip = '右でスタイル（スタッド/フック/フープ/ドロップ）と石を選べます';
  } else if (p.kind === 'bracelet') {
    tip = '右で内周・プレート幅・リンク数を調整できます';
  } else {
    tip = '右パネルで寸法を調整できます';
  }
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 max-w-[60%] rounded-md bg-gold-500/10 px-2.5 py-1 text-[10px] text-gold-400 ring-1 ring-gold-500/20">
      💡 {tip}
    </div>
  );
}
