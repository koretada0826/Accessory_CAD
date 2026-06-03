'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer, ContactShadows, Grid, Html, GizmoHelper, GizmoViewcube } from '@react-three/drei';
import * as THREE from 'three';
import { useDesignStore } from '@/store/useDesignStore';
import { buildModel } from '@/lib/geometry';
import { MATERIALS } from '@/lib/data/materials';
import EngravingDecal from './EngravingDecal';

type ViewPreset = 'persp' | 'front' | 'side' | 'back' | 'top';

/** 構造JSON → メッシュ群。選択パーツをハイライト */
function AccessoryMeshes({ wireframe }: { wireframe: boolean }) {
  const design = useDesignStore((s) => s.design);
  const selectedId = useDesignStore((s) => s.selectedComponentId);
  const components = design.components;
  const selectComponent = useDesignStore((s) => s.selectComponent);
  const moveStone = useDesignStore((s) => s.moveStone);
  const controls = useThree((s) => s.controls) as any;

  // 石ドラッグ（ペンダントのみ）
  const [drag, setDrag] = useState<{ index: number; z: number } | null>(null);
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
    }
    return { model, mat, patternRoughness };
  }, [design]);

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
          return (
            <mesh key={part.id} geometry={part.geometry}>
              <meshPhysicalMaterial
                color={part.color ?? '#bfe9ff'}
                metalness={0}
                roughness={0.02}
                transmission={0.55}
                thickness={1.2}
                ior={2.2}
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
            <meshStandardMaterial
              color={highlighted ? new THREE.Color(mat.color).lerp(new THREE.Color('#ffffff'), 0.15) : mat.color}
              metalness={mat.metalness}
              roughness={patternRoughness}
              emissive={highlighted ? new THREE.Color('#e6c068') : new THREE.Color('#000000')}
              emissiveIntensity={highlighted ? 0.25 : 0}
              envMapIntensity={1.2}
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
                setDrag({ index: i, z });
                if (controls) controls.enabled = false;
                document.body.style.cursor = 'grabbing';
              }}
            >
              <sphereGeometry args={[r, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          );
        })}

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
              moveStone(drag.index, Math.round(x * 10) / 10, Math.round(y * 10) / 10, firstMove.current);
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
function CameraRig({ preset, presetNonce }: { preset: ViewPreset; presetNonce: number }) {
  const design = useDesignStore((s) => s.design);
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as any;

  const maxDim = useMemo(() => {
    const b = buildModel(design).bounds;
    return Math.max(b.width, b.height, b.depth, 8);
  }, [design]);

  useEffect(() => {
    const d = maxDim * 2.6;
    const pos: Record<ViewPreset, [number, number, number]> = {
      persp: [d * 0.7, d * 0.55, d * 0.9],
      front: [0, 0, d],
      side: [d, 0, 0.0001],
      back: [0, 0, -d],
      top: [0, d, 0.0001],
    };
    camera.position.set(...pos[preset]);
    camera.lookAt(0, 0, 0);
    (camera as THREE.PerspectiveCamera).near = 0.1;
    (camera as THREE.PerspectiveCamera).far = d * 10;
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, presetNonce, maxDim]);

  return null;
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
  const [wireframe, setWireframe] = useState(false);
  const [grid, setGrid] = useState(true);
  const [dims, setDims] = useState(true);
  const [preset, setPreset] = useState<ViewPreset>('persp');
  const [nonce, setNonce] = useState(0);
  const [spin, setSpin] = useState(false);

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

  const Btn = ({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
        active ? 'bg-ink-700 text-white' : 'bg-ink-850/70 text-ink-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="relative h-full w-full">
      {/* ビュー操作ツールバー */}
      <div className="pointer-events-auto absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-1 rounded-xl border border-ink-700 bg-ink-900/70 p-1 backdrop-blur">
        <Btn active={preset === 'persp'} onClick={() => setView('persp')}>透視</Btn>
        <Btn active={preset === 'front'} onClick={() => setView('front')}>正面</Btn>
        <Btn active={preset === 'side'} onClick={() => setView('side')}>側面</Btn>
        <Btn active={preset === 'back'} onClick={() => setView('back')}>背面</Btn>
        <Btn active={preset === 'top'} onClick={() => setView('top')}>上面</Btn>
        <div className="mx-1 w-px bg-ink-700" />
        <Btn active={wireframe} onClick={() => setWireframe((v) => !v)}>ワイヤー</Btn>
        <Btn active={grid} onClick={() => setGrid((v) => !v)}>グリッド</Btn>
        <Btn active={dims} onClick={() => setDims((v) => !v)}>寸法</Btn>
        <Btn active={spin} onClick={() => setSpin((v) => !v)}>自動回転</Btn>
      </div>

      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 35, position: [30, 22, 36] }}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        resize={{ debounce: 0, scroll: false }}
        onCreated={(state) => state.gl.render(state.scene, state.camera)}
        onPointerMissed={() => useDesignStore.getState().selectComponent(null)}
      >
        <color attach="background" args={['#0c0c12']} />
        {/* 直接光（envが無くてもモデルが必ず見えるよう十分に確保） */}
        <ambientLight intensity={0.6} />
        <hemisphereLight args={['#ffffff', '#202028', 0.6]} />
        <directionalLight position={[20, 30, 20]} intensity={1.6} castShadow />
        <directionalLight position={[-18, 10, -12]} intensity={0.7} color="#9db4ff" />
        <directionalLight position={[0, -10, -20]} intensity={0.5} color="#ffe9c0" />

        {/* 手続き的な環境光（CDN不要・オフライン可）で金属を綺麗に映す。
            万一サスペンドしてもモデル/グリッドを巻き込まないよう独立Suspenseで隔離 */}
        <Suspense fallback={null}>
          <Environment resolution={256}>
            <group>
              <Lightformer form="rect" intensity={3} position={[0, 8, 6]} scale={[10, 6, 1]} color="#ffffff" />
              <Lightformer form="rect" intensity={2} position={[-8, 4, -6]} scale={[8, 8, 1]} color="#ffe9c0" />
              <Lightformer form="rect" intensity={1.5} position={[8, 2, -6]} scale={[8, 8, 1]} color="#cfe0ff" />
              <Lightformer form="ring" intensity={2} position={[0, -6, 8]} scale={[6, 6, 1]} color="#ffffff" />
            </group>
          </Environment>
        </Suspense>

        <CameraRig preset={preset} presetNonce={nonce} />
        <AccessoryMeshes wireframe={wireframe} />
        {dims && <DimensionLabel />}

        <ContactShadows position={[0, -12, 0]} opacity={0.4} scale={80} blur={2.5} far={30} resolution={512} color="#000000" />
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
      </Canvas>

      <ContextTip />

      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-ink-900/70 px-2 py-1 text-[10px] text-ink-500">
        ドラッグ=回転 / ホイール=ズーム / 右ドラッグ=パン ・ パーツをクリックで選択
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
    tip = design.stones.length > 0
      ? '石はドラッグで動かせます。チャットで「石を大きく」もOK'
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
