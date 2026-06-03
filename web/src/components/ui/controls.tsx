'use client';

import { clsx } from 'clsx';
import { ReactNode } from 'react';

/** セクション見出し付きの折り畳みなしブロック */
export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="hairline-b py-4">
      <div className="mb-2.5 flex items-center justify-between px-4">
        <h3 className="text-[10px] font-medium uppercase tracking-luxe text-ink-500">{title}</h3>
        {right}
      </div>
      <div className="space-y-3 px-4">{children}</div>
    </div>
  );
}

/** スライダー + 数値入力の複合（ノーコード感 ＋ 数値もいじれる） */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit = 'mm',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs text-ink-300/90">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clampNum(parseFloat(e.target.value), min, max))}
            className="w-16 rounded-lg border border-ink-700 bg-ink-950/60 px-2 py-1 text-right text-xs tabular-nums text-white outline-none transition-colors focus:border-gold-500/70 focus:bg-ink-900"
          />
          <span className="w-6 text-[10px] text-ink-500">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        className="w-full"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

function clampNum(v: number, lo: number, hi: number) {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/** トグル */
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs text-ink-300 hover:text-white"
    >
      <span>{label}</span>
      <span
        className={clsx(
          'relative h-5 w-9 rounded-full transition-colors duration-300',
          checked ? 'bg-gold-sheen shadow-gold' : 'bg-ink-700'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </span>
    </button>
  );
}

/** セグメント選択（プロファイル/形状など） */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-0.5 rounded-xl border border-ink-700/60 bg-ink-950/50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs transition-all duration-200',
            value === o.value
              ? 'border border-gold-500/30 bg-ink-800 font-medium text-gold-400 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset]'
              : 'border border-transparent text-ink-400 hover:text-white'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs text-ink-300/90">{label}</label>
      {children}
    </div>
  );
}
