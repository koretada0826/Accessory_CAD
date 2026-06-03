'use client';

import { nanoid } from 'nanoid';
import { useDesignStore } from '@/store/useDesignStore';
import { Section, SliderField, Segmented, Toggle, Field } from '@/components/ui/controls';
import { MATERIAL_LIST } from '@/lib/data/materials';
import { innerDiameterToJpSize, nearestJpSize } from '@/lib/data/ringSize';
import { CATEGORY_LABELS } from '@/lib/data/factory';
import { HelpHint } from '@/components/ui/HelpHint';
import type { MaterialId } from '@/types/accessory';

export default function PropertyPanel() {
  const design = useDesignStore((s) => s.design);
  const commit = useDesignStore((s) => s.commit);
  const setMaterial = useDesignStore((s) => s.setMaterial);
  const selectedId = useDesignStore((s) => s.selectedComponentId);
  const selectComponent = useDesignStore((s) => s.selectComponent);
  const uiMode = useDesignStore((s) => s.uiMode);
  const pro = uiMode === 'pro';
  const p = design.params;

  // 刻印を載せられる面（ペンダント前面 / リングの印台・ドーム上面）。null=非対応カテゴリ
  const engraveFace =
    p.kind === 'pendant'
      ? { w: p.width, h: p.height, where: '前面' }
      : p.kind === 'ring' && (p.top.type === 'signet' || p.top.type === 'dome')
        ? { w: p.top.width, h: p.top.length, where: p.top.type === 'dome' ? 'ドーム上面' : '印台上面' }
        : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* ヘッダ */}
      <div className="hairline-b px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-luxe text-ink-500">編集中</span>
          <HelpHint text="スライダーでサイズ・厚み・素材を調整。名前はここで変更できます。迷ったら上部の『かんたん』モードを。" side="left" />
        </div>
        <input
          value={design.name}
          onChange={(e) => commit((d) => void (d.name = e.target.value))}
          className="mt-1 w-full bg-transparent font-display text-lg font-medium text-white outline-none placeholder:text-ink-600"
        />
        <div className="mt-0.5 text-[11px] tracking-wide text-gold-400">{CATEGORY_LABELS[design.category]}</div>
      </div>

      {/* パーツ選択（プロモードのみ） */}
      {pro && (
      <Section title="パーツ">
        <div className="flex flex-wrap gap-1">
          {design.components.map((c) => (
            <button
              key={c.id}
              onClick={() => selectComponent(c.id === selectedId ? null : c.id)}
              className={`rounded-md px-2 py-1 text-xs ${
                c.id === selectedId ? 'bg-gold-500 text-ink-950' : 'bg-ink-800 text-ink-300 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {selectedId && (
          <Toggle
            label="このパーツを表示"
            checked={design.components.find((c) => c.id === selectedId)?.visible ?? true}
            onChange={(v) =>
              commit((d) => {
                const c = d.components.find((x) => x.id === selectedId);
                if (c) c.visible = v;
              })
            }
          />
        )}
      </Section>
      )}

      {/* ===== カテゴリ別パラメータ ===== */}
      {p.kind === 'ring' && (
        <Section title="リング寸法">
          <Field label="リングサイズ">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={nearestJpSize(p.innerDiameter)}
                min={1}
                max={30}
                onChange={(e) =>
                  commit((d) => {
                    if (d.params.kind === 'ring') d.params.innerDiameter = Math.round(((parseInt(e.target.value) + 39) / Math.PI) * 100) / 100;
                  })
                }
                className="w-14 rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-right text-xs text-white outline-none focus:border-gold-500"
              />
              <span className="text-[10px] text-ink-500">号</span>
            </div>
          </Field>
          <SliderField label="内径" value={p.innerDiameter} min={13} max={23} step={0.05}
            onChange={(v) => commit((d) => { if (d.params.kind === 'ring') d.params.innerDiameter = v; })} />
          <div className="text-right text-[10px] text-ink-500">≒ {innerDiameterToJpSize(p.innerDiameter).toFixed(1)}号</div>
          <SliderField label="バンド幅" value={p.bandWidth} min={1} max={12}
            onChange={(v) => commit((d) => { if (d.params.kind === 'ring') d.params.bandWidth = v; })} />
          <SliderField label="バンド厚" value={p.bandThickness} min={0.6} max={5}
            onChange={(v) => commit((d) => { if (d.params.kind === 'ring') d.params.bandThickness = v; })} />
          <div>
            <div className="mb-1 text-xs text-ink-300/90">断面プロファイル</div>
            <Segmented
              value={p.profile}
              onChange={(v) => commit((d) => { if (d.params.kind === 'ring') d.params.profile = v; })}
              options={[
                { value: 'flat', label: '平打' },
                { value: 'comfort', label: '甲丸' },
                { value: 'round', label: '丸' },
                { value: 'knife', label: 'ナイフ' },
              ]}
            />
          </div>
          <Toggle
            label="ミル打ち（縁の粒飾り）"
            checked={!!p.milgrain}
            onChange={(v) => commit((d) => { if (d.params.kind === 'ring') d.params.milgrain = v; })}
          />
          <div>
            <div className="mb-1 text-xs text-ink-300/90">パヴェ留め（小粒石）</div>
            <Segmented
              value={p.pave ?? 'none'}
              onChange={(v) => commit((d) => { if (d.params.kind === 'ring') d.params.pave = v; })}
              options={[
                { value: 'none', label: 'なし' },
                { value: 'shoulder', label: '肩' },
                { value: 'full', label: '全周' },
              ]}
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-ink-300/90">トップ</div>
            <Segmented
              value={p.top.type}
              onChange={(v) => commit((d) => { if (d.params.kind === 'ring') d.params.top.type = v; })}
              options={[
                { value: 'none', label: 'なし' },
                { value: 'signet', label: '印台' },
                { value: 'stone', label: '石' },
                { value: 'dome', label: 'ドーム' },
              ]}
            />
          </div>
          {p.top.type !== 'none' && (
            <>
              <SliderField label="トップ幅" value={p.top.width} min={3} max={20}
                onChange={(v) => commit((d) => { if (d.params.kind === 'ring') d.params.top.width = v; })} />
              <SliderField label="トップ奥行" value={p.top.length} min={3} max={20}
                onChange={(v) => commit((d) => { if (d.params.kind === 'ring') d.params.top.length = v; })} />
              <SliderField label="トップ高さ" value={p.top.height} min={1} max={8}
                onChange={(v) => commit((d) => { if (d.params.kind === 'ring') d.params.top.height = v; })} />
            </>
          )}
        </Section>
      )}

      {p.kind === 'pendant' && (
        <Section title="ペンダント寸法">
          <div>
            <div className="mb-1 text-xs text-ink-300/90">外形</div>
            <Segmented
              value={p.shape}
              onChange={(v) => commit((d) => { if (d.params.kind === 'pendant') d.params.shape = v; })}
              options={[
                ...(p.outline ? [{ value: 'custom' as const, label: '📷画像' }] : []),
                { value: 'disc', label: '円' },
                { value: 'oval', label: '楕円' },
                { value: 'tag', label: 'タグ' },
                { value: 'heart', label: 'ハート' },
                { value: 'shield', label: '盾' },
                { value: 'hexagon', label: '六角' },
              ]}
            />
          </div>
          <SliderField label="幅" value={p.width} min={6} max={60} step={0.5}
            onChange={(v) => commit((d) => { if (d.params.kind === 'pendant') d.params.width = v; })} />
          <SliderField label="高さ" value={p.height} min={6} max={60} step={0.5}
            onChange={(v) => commit((d) => { if (d.params.kind === 'pendant') d.params.height = v; })} />
          <SliderField label="厚み" value={p.thickness} min={0.5} max={5}
            onChange={(v) => commit((d) => { if (d.params.kind === 'pendant') d.params.thickness = v; })} />
          <SliderField label="角丸" value={p.cornerRadius} min={0} max={12}
            onChange={(v) => commit((d) => { if (d.params.kind === 'pendant') d.params.cornerRadius = v; })} />
          {p.relief && (
            <SliderField label="立体レリーフの強さ" value={p.relief.depth} min={0} max={4} step={0.1} unit="mm"
              onChange={(v) => commit((d) => { if (d.params.kind === 'pendant' && d.params.relief) d.params.relief.depth = v; })} />
          )}
          <div>
            <div className="mb-1 text-xs text-ink-300/90">バチカン</div>
            <Segmented
              value={p.bail.type}
              onChange={(v) => commit((d) => { if (d.params.kind === 'pendant') d.params.bail.type = v; })}
              options={[
                { value: 'integrated_hole', label: '吊り穴' },
                { value: 'ring_bail', label: '丸カン' },
                { value: 'tube', label: 'チューブ' },
                { value: 'none', label: 'なし' },
              ]}
            />
          </div>
          {p.bail.type !== 'none' && (
            <>
              <SliderField label="穴/内径" value={p.bail.innerDiameter} min={1} max={8}
                onChange={(v) => commit((d) => { if (d.params.kind === 'pendant') d.params.bail.innerDiameter = v; })} />
              <SliderField label="縁の肉厚" value={p.bail.wall} min={0.5} max={4}
                onChange={(v) => commit((d) => { if (d.params.kind === 'pendant') d.params.bail.wall = v; })} />
            </>
          )}
        </Section>
      )}

      {p.kind === 'earrings' && (
        <Section title="ピアス寸法">
          <div>
            <Segmented
              value={p.style}
              onChange={(v) => commit((d) => { if (d.params.kind === 'earrings') d.params.style = v; })}
              options={[
                { value: 'stud', label: 'スタッド' },
                { value: 'hook', label: 'フック' },
                { value: 'hoop', label: 'フープ' },
                { value: 'drop', label: 'ドロップ' },
              ]}
            />
          </div>
          {p.style === 'hoop' ? (
            <SliderField label="フープ径" value={p.hoopDiameter} min={6} max={40}
              onChange={(v) => commit((d) => { if (d.params.kind === 'earrings') d.params.hoopDiameter = v; })} />
          ) : (
            <>
              <SliderField label="本体幅" value={p.bodyWidth} min={3} max={25}
                onChange={(v) => commit((d) => { if (d.params.kind === 'earrings') d.params.bodyWidth = v; })} />
              <SliderField label="本体高さ" value={p.bodyHeight} min={3} max={25}
                onChange={(v) => commit((d) => { if (d.params.kind === 'earrings') d.params.bodyHeight = v; })} />
              <SliderField label="厚み" value={p.thickness} min={0.5} max={4}
                onChange={(v) => commit((d) => { if (d.params.kind === 'earrings') d.params.thickness = v; })} />
            </>
          )}
          <SliderField label="ワイヤー径" value={p.wireDiameter} min={0.5} max={3} step={0.05}
            onChange={(v) => commit((d) => { if (d.params.kind === 'earrings') d.params.wireDiameter = v; })} />
        </Section>
      )}

      {p.kind === 'bracelet' && (
        <Section title="ブレスレット寸法">
          <div>
            <Segmented
              value={p.style}
              onChange={(v) => commit((d) => { if (d.params.kind === 'bracelet') d.params.style = v; })}
              options={[
                { value: 'plate', label: 'プレート' },
                { value: 'link', label: 'リンク' },
                { value: 'bangle', label: 'バングル' },
              ]}
            />
          </div>
          <SliderField label="内周" value={p.innerCircumference} min={140} max={220} step={1} unit="mm"
            onChange={(v) => commit((d) => { if (d.params.kind === 'bracelet') d.params.innerCircumference = v; })} />
          <SliderField label="プレート幅" value={p.plateWidth} min={3} max={25}
            onChange={(v) => commit((d) => { if (d.params.kind === 'bracelet') d.params.plateWidth = v; })} />
          <SliderField label="プレート長" value={p.plateLength} min={8} max={60}
            onChange={(v) => commit((d) => { if (d.params.kind === 'bracelet') d.params.plateLength = v; })} />
          <SliderField label="厚み" value={p.thickness} min={0.6} max={4}
            onChange={(v) => commit((d) => { if (d.params.kind === 'bracelet') d.params.thickness = v; })} />
          <SliderField label="リンク数" value={p.linkCount} min={0} max={12} step={1} unit="個"
            onChange={(v) => commit((d) => { if (d.params.kind === 'bracelet') d.params.linkCount = Math.round(v); })} />
        </Section>
      )}

      {p.kind === 'generic' && (
        <Section title="寸法">
          <SliderField label="幅" value={p.width} min={4} max={60} onChange={(v) => commit((d) => { if (d.params.kind === 'generic') d.params.width = v; })} />
          <SliderField label="高さ" value={p.height} min={4} max={60} onChange={(v) => commit((d) => { if (d.params.kind === 'generic') d.params.height = v; })} />
          <SliderField label="厚み" value={p.thickness} min={0.6} max={6} onChange={(v) => commit((d) => { if (d.params.kind === 'generic') d.params.thickness = v; })} />
          <div className="rounded-md bg-ink-800/60 p-2 text-[11px] text-ink-400">
            このカテゴリは汎用エディタで表示中です（専用UIは今後実装）。
          </div>
        </Section>
      )}

      {/* ===== 石 ===== */}
      <Section
        title="石 (ストーン)"
        right={
          <button
            onClick={() =>
              commit((d) =>
                d.stones.push({ id: nanoid(8), cut: 'round', setting: p.kind === 'ring' ? 'prong' : 'bezel', diameter: 3, position: { x: 0, y: 0 }, height: 1.5, color: '#bfe9ff' })
              )
            }
            className="rounded-md bg-ink-800 px-2 py-0.5 text-[11px] text-gold-400 hover:bg-ink-700"
          >
            + 追加
          </button>
        }
      >
        {design.stones.length === 0 && <div className="text-[11px] text-ink-500">石はまだありません。</div>}
        {design.stones.map((s, i) => (
          <div key={s.id} className="rounded-lg bg-ink-800/60 p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] text-ink-300">石 {i + 1}</span>
              <button onClick={() => commit((d) => void d.stones.splice(i, 1))} className="text-[11px] text-red-400/80 hover:text-red-300">削除</button>
            </div>
            <SliderField label="径" value={s.diameter} min={1} max={10} step={0.1}
              onChange={(v) => commit((d) => { d.stones[i].diameter = v; })} />
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <select
                value={s.cut}
                onChange={(e) => commit((d) => { (d.stones[i].cut as any) = e.target.value; })}
                className="rounded-md border border-ink-700 bg-ink-900 px-1.5 py-1 text-[11px] text-white outline-none"
              >
                {['round', 'oval', 'princess', 'pear', 'marquise', 'cabochon'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={s.setting}
                onChange={(e) => commit((d) => { (d.stones[i].setting as any) = e.target.value; })}
                className="rounded-md border border-ink-700 bg-ink-900 px-1.5 py-1 text-[11px] text-white outline-none"
              >
                {['prong', 'bezel', 'flush', 'pave', 'none'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[11px] text-ink-400">色</span>
              <input type="color" value={s.color} onChange={(e) => commit((d) => { d.stones[i].color = e.target.value; })} className="h-6 w-10 cursor-pointer rounded bg-transparent" />
            </div>
          </div>
        ))}
      </Section>

      {/* ===== 刻印（ペンダント前面 / リング印台・ドーム上面） ===== */}
      {engraveFace && (
        <Section
          title={`刻印 (${engraveFace.where})`}
          right={
            <button
              onClick={() =>
                commit((d) =>
                  d.engraving.push({ id: nanoid(8), text: 'LOVE', size: 4, depth: -0.4, position: { x: 0, y: 0 }, font: 'serif' })
                )
              }
              className="rounded-md bg-ink-800 px-2 py-0.5 text-[11px] text-gold-400 hover:bg-ink-700"
            >
              + 追加
            </button>
          }
        >
          {design.engraving.length === 0 && <div className="text-[11px] text-ink-500">文字を刻めます（名入れ・日付など）。</div>}
          {design.engraving.map((e, i) => (
            <div key={e.id} className="rounded-lg bg-ink-800/60 p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <input
                  value={e.text}
                  onChange={(ev) => commit((d) => { d.engraving[i].text = ev.target.value; })}
                  placeholder="文字を入力"
                  className="w-32 rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-white outline-none focus:border-gold-500"
                />
                <button onClick={() => commit((d) => void d.engraving.splice(i, 1))} className="text-[11px] text-red-400/80 hover:text-red-300">削除</button>
              </div>
              <SliderField label="文字サイズ" value={e.size} min={1.5} max={12} step={0.1}
                onChange={(v) => commit((d) => { d.engraving[i].size = v; })} />
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <Segmented
                  value={e.depth < 0 ? 'deboss' : 'emboss'}
                  onChange={(v) => commit((d) => { d.engraving[i].depth = v === 'deboss' ? -0.4 : 0.4; })}
                  options={[
                    { value: 'deboss', label: '凹 彫り' },
                    { value: 'emboss', label: '凸 浮き' },
                  ]}
                />
                <select
                  value={e.font}
                  onChange={(ev) => commit((d) => { (d.engraving[i].font as any) = ev.target.value; })}
                  className="rounded-md border border-ink-700 bg-ink-900 px-1.5 py-1 text-[11px] text-white outline-none"
                >
                  <option value="serif">明朝/Serif</option>
                  <option value="sans">ゴシック/Sans</option>
                  <option value="script">筆記体/Script</option>
                </select>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <SliderField label="左右位置" value={e.position.x} min={-engraveFace.w / 2} max={engraveFace.w / 2} step={0.5} unit="mm"
                  onChange={(v) => commit((d) => { d.engraving[i].position.x = v; })} />
                <SliderField label="上下位置" value={e.position.y} min={-engraveFace.h / 2} max={engraveFace.h / 2} step={0.5} unit="mm"
                  onChange={(v) => commit((d) => { d.engraving[i].position.y = v; })} />
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* ===== 素材 ===== */}
      <Section title="素材">
        <div className="grid grid-cols-2 gap-1.5">
          {MATERIAL_LIST.map((m) => (
            <button
              key={m.id}
              onClick={() => setMaterial(m.id as MaterialId)}
              className={`flex items-center gap-2 rounded-lg border p-1.5 text-left text-[11px] ${
                design.materialId === m.id ? 'border-gold-500 bg-ink-800' : 'border-ink-700 bg-ink-900 hover:border-ink-600'
              }`}
            >
              <span className="h-5 w-5 rounded-full ring-1 ring-white/10" style={{ background: m.color }} />
              <span className="leading-tight text-ink-200">{m.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* ===== 仕上げ（全モード） ===== */}
      <Section title="仕上げ">
        <Segmented
          value={(design.patterns[0]?.type ?? 'none') as any}
          onChange={(v) =>
            commit((d) => {
              d.patterns = v === 'none' ? [] : [{ id: nanoid(6), type: v as any, intensity: 0.7 }];
            })
          }
          options={[
            { value: 'none', label: '鏡面' },
            { value: 'hammered', label: '槌目' },
            { value: 'brushed', label: 'つや消' },
            { value: 'gothic', label: 'ゴシック' },
          ]}
        />
        {pro && (
          <>
            <Toggle label="左右対称 (mirror X)" checked={design.symmetry.mirrorX} onChange={(v) => commit((d) => void (d.symmetry.mirrorX = v))} />
            <Toggle label="上下対称 (mirror Y)" checked={design.symmetry.mirrorY} onChange={(v) => commit((d) => void (d.symmetry.mirrorY = v))} />
          </>
        )}
      </Section>
    </div>
  );
}
