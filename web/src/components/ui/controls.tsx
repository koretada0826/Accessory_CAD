'use client';

import { clsx } from 'clsx';
import { ReactNode } from 'react';

/** セクション見出し付きの折り畳みなしブロック */
export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="border-b border-ink-700/70 py-3">
      <div className="mb-2 flex items-center justify-between px-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{title}</h3>
        {right}
      </div>
      <div className="space-y-2.5 px-3">{children}</div>
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
            className="w-16 rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-right text-xs tabular-nums text-white outline-none focus:border-gold-500"
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
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-gold-500' : 'bg-ink-700'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
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
    <div className="flex flex-wrap gap-1 rounded-lg bg-ink-900 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs transition-colors',
            value === o.value ? 'bg-ink-700 text-white shadow-sm' : 'text-ink-400 hover:text-white'
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
