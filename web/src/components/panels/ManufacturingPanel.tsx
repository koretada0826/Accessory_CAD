'use client';

import { useDesignStore } from '@/store/useDesignStore';

const SEVERITY_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  error: { dot: 'bg-red-500', text: 'text-red-300', label: '要修正' },
  warning: { dot: 'bg-amber-400', text: 'text-amber-200', label: '注意' },
  info: { dot: 'bg-emerald-400', text: 'text-emerald-200', label: 'OK' },
};

export default function ManufacturingPanel() {
  const report = useDesignStore((s) => s.report);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-700 px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">製造チェック</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            report.printable ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
          }`}
        >
          {report.printable ? '3Dプリント可' : '要修正'}
        </span>
      </div>

      {/* 推定指標 */}
      <div className="grid grid-cols-3 gap-px bg-ink-700/60 text-center">
        <Stat label="推定重量" value={`${report.weightGram} g`} />
        <Stat label="参考原価" value={`¥${report.costYen.toLocaleString()}`} />
        <Stat label="体積" value={`${(report.volumeMm3 / 1000).toFixed(2)} cm³`} />
      </div>

      {/* 警告リスト */}
      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {report.warnings.map((wn) => {
          const st = SEVERITY_STYLE[wn.severity];
          return (
            <div key={wn.id} className="rounded-lg border border-ink-700 bg-ink-850/60 p-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                <span className={`text-xs font-medium ${st.text}`}>{wn.title}</span>
              </div>
              <p className="mt-1 pl-4 text-[11px] leading-relaxed text-ink-400">{wn.detail}</p>
              {wn.suggestion && (
                <p className="mt-1 pl-4 text-[11px] text-gold-400">💡 {wn.suggestion}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-900 py-2">
      <div className="text-[10px] text-ink-500">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}
