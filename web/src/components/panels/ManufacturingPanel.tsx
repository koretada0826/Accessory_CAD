'use client';

import { useDesignStore } from '@/store/useDesignStore';
import { HelpHint } from '@/components/ui/HelpHint';

const SEVERITY_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  error: { dot: 'bg-red-500', text: 'text-red-300', label: '要修正' },
  warning: { dot: 'bg-amber-400', text: 'text-amber-200', label: '注意' },
  info: { dot: 'bg-emerald-400', text: 'text-emerald-200', label: 'OK' },
};

export default function ManufacturingPanel() {
  const report = useDesignStore((s) => s.report);

  return (
    <div className="flex h-full flex-col">
      <div className="hairline-b flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[10px] font-medium uppercase tracking-luxe text-ink-500">製造チェック</h3>
          <HelpHint text="重量・原価の概算と、3Dプリント/鋳造の注意点を自動チェック。「要修正」が無ければそのまま工場に出せます。" />
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
            report.printable ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${report.printable ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {report.printable ? '製造可能' : '要修正'}
        </span>
      </div>

      {/* 推定指標 */}
      <div className="grid grid-cols-3 px-4 py-3">
        <Stat label="推定重量" value={`${report.weightGram}`} unit="g" />
        <Stat label="参考原価" value={`¥${report.costYen.toLocaleString()}`} border />
        <Stat label="体積" value={`${(report.volumeMm3 / 1000).toFixed(2)}`} unit="cm³" border />
      </div>

      {/* 警告リスト */}
      <div className="hairline-t flex-1 space-y-1.5 overflow-y-auto p-3">
        {report.warnings.map((wn) => {
          const st = SEVERITY_STYLE[wn.severity];
          return (
            <div key={wn.id} className="rounded-xl border border-ink-700/60 bg-ink-850/40 p-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                <span className={`text-xs font-medium ${st.text}`}>{wn.title}</span>
              </div>
              <p className="mt-1 pl-3.5 text-[11px] leading-relaxed text-ink-400">{wn.detail}</p>
              {wn.suggestion && (
                <p className="mt-1 pl-3.5 text-[11px] text-gold-400">{wn.suggestion}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, unit, border }: { label: string; value: string; unit?: string; border?: boolean }) {
  return (
    <div className={`px-3 text-center ${border ? 'border-l border-white/8' : ''}`}>
      <div className="text-[9px] uppercase tracking-luxe text-ink-500">{label}</div>
      <div className="mt-0.5 font-display text-xl font-medium tabular-nums text-white">
        {value}
        {unit && <span className="ml-0.5 text-xs text-ink-400">{unit}</span>}
      </div>
    </div>
  );
}
