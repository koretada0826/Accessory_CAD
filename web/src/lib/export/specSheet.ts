import type { AccessoryDesign } from '@/types/accessory';
import { runManufacturingCheck } from '@/lib/manufacturing/check';
import { MATERIALS } from '@/lib/data/materials';
import { CATEGORY_LABELS } from '@/lib/data/factory';
import { innerDiameterToJpSize } from '@/lib/data/ringSize';
import { buildShape } from '@/lib/geometry/primitives';

/**
 * 技術仕様書（Spec Sheet）を自己完結HTMLで生成。
 * 工場・原型師への提案/見積依頼に使える「寸法・素材・重量・公差・製造注意」を1枚に。
 * ブラウザでそのまま開け、印刷→PDF化できる（外部依存なし・API課金なし）。
 */
export function buildSpecSheetHTML(design: AccessoryDesign): string {
  const report = runManufacturingCheck(design);
  const mat = MATERIALS[design.materialId];
  const p = design.params;

  // 寸法表（カテゴリ別）
  const dims: [string, string][] = [];
  if (p.kind === 'ring') {
    dims.push(['内径', `${p.innerDiameter.toFixed(2)} mm（≒ ${innerDiameterToJpSize(p.innerDiameter).toFixed(1)} 号）`]);
    dims.push(['外径', `${(p.innerDiameter + p.bandThickness * 2).toFixed(2)} mm`]);
    dims.push(['バンド幅', `${p.bandWidth.toFixed(2)} mm`]);
    dims.push(['バンド厚', `${p.bandThickness.toFixed(2)} mm`]);
    dims.push(['断面プロファイル', p.profile]);
    if (p.top.type !== 'none') dims.push(['トップ', `${p.top.type} (${p.top.width}×${p.top.length}×${p.top.height} mm)`]);
  } else if (p.kind === 'pendant') {
    dims.push(['外形', p.shape]);
    dims.push(['幅', `${p.width.toFixed(2)} mm`]);
    dims.push(['高さ', `${p.height.toFixed(2)} mm`]);
    dims.push(['厚み', `${p.thickness.toFixed(2)} mm`]);
    dims.push(['バチカン', `${p.bail.type}（内径 ${p.bail.innerDiameter} mm / 縁肉 ${p.bail.wall} mm）`]);
  } else if (p.kind === 'earrings') {
    dims.push(['スタイル', p.style]);
    dims.push(['本体', `${p.bodyWidth}×${p.bodyHeight}×${p.thickness} mm`]);
    dims.push(['ワイヤー径', `${p.wireDiameter} mm`]);
  } else if (p.kind === 'bracelet') {
    dims.push(['スタイル', p.style]);
    dims.push(['内周', `${p.innerCircumference} mm`]);
    dims.push(['プレート', `${p.plateWidth}×${p.plateLength}×${p.thickness} mm`]);
  } else {
    dims.push(['寸法', `${p.width}×${p.height}×${p.thickness} mm`]);
  }

  // 石の表
  const stoneRows = design.stones
    .map((s, i) => `<tr><td>石${i + 1}</td><td>${s.cut}</td><td>${s.setting}</td><td>${s.diameter} mm</td><td><span class="sw" style="background:${s.color}"></span>${s.color}</td></tr>`)
    .join('');

  // 警告の表
  const warnRows = report.warnings
    .map((w) => `<tr class="sev-${w.severity}"><td>${sevLabel(w.severity)}</td><td>${esc(w.title)}</td><td>${esc(w.detail)}${w.suggestion ? `<br><em>→ ${esc(w.suggestion)}</em>` : ''}</td></tr>`)
    .join('');

  // 2D外形 SVG
  const outline = outlineSVG(design);

  const dimRows = dims.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('');

  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<title>仕様書 - ${esc(design.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Hiragino Kaku Gothic ProN','Noto Sans JP',system-ui,sans-serif; color:#1a1a1a; margin:0; padding:32px; background:#fff; }
  .sheet { max-width: 820px; margin: 0 auto; }
  header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #caa24a; padding-bottom:12px; margin-bottom:20px; }
  h1 { font-size:22px; margin:0; }
  .meta { color:#666; font-size:12px; text-align:right; }
  .brand { color:#caa24a; font-weight:700; letter-spacing:2px; font-size:12px; }
  .grid { display:grid; grid-template-columns: 1.1fr 0.9fr; gap:20px; }
  .kpis { display:flex; gap:10px; margin:16px 0; }
  .kpi { flex:1; border:1px solid #e3e3e3; border-radius:10px; padding:10px 12px; }
  .kpi .l { font-size:11px; color:#888; } .kpi .v { font-size:20px; font-weight:700; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:1px; color:#888; border-bottom:1px solid #eee; padding-bottom:6px; margin:18px 0 8px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th,td { text-align:left; padding:6px 8px; border-bottom:1px solid #f0f0f0; vertical-align:top; }
  table.kv th { width:38%; color:#555; font-weight:600; }
  .sw { display:inline-block; width:12px; height:12px; border-radius:50%; vertical-align:middle; margin-right:5px; border:1px solid #0002; }
  .sev-error td:first-child { color:#c0392b; font-weight:700; }
  .sev-warning td:first-child { color:#b9770e; font-weight:700; }
  .sev-info td:first-child { color:#1f8a4c; font-weight:700; }
  .outline { border:1px solid #eee; border-radius:10px; padding:12px; text-align:center; background:#fafafa; }
  .badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700; }
  .ok { background:#e7f7ee; color:#1f8a4c; } .ng { background:#fdecea; color:#c0392b; }
  footer { margin-top:24px; color:#999; font-size:11px; text-align:center; }
  @media print { body { padding:0; } .noprint { display:none; } }
</style></head>
<body><div class="sheet">
  <header>
    <div><div class="brand">ATELIER — AI ACCESSORY CAD</div><h1>${esc(design.name)}</h1>
      <div style="color:#666;font-size:13px;margin-top:2px;">${CATEGORY_LABELS[design.category]} ・ 単位: mm</div></div>
    <div class="meta">技術仕様書 / Spec Sheet<br>${new Date().toLocaleString('ja-JP')}<br>ID: ${design.id}</div>
  </header>

  <div class="kpis">
    <div class="kpi"><div class="l">素材</div><div class="v" style="font-size:15px">${mat.label}</div></div>
    <div class="kpi"><div class="l">推定重量</div><div class="v">${report.weightGram} g</div></div>
    <div class="kpi"><div class="l">参考原価</div><div class="v">¥${report.costYen.toLocaleString()}</div></div>
    <div class="kpi"><div class="l">製造可否</div><div class="v"><span class="badge ${report.printable ? 'ok' : 'ng'}">${report.printable ? '製造可' : '要修正'}</span></div></div>
  </div>

  <div class="grid">
    <div>
      <h2>寸法 / Dimensions</h2>
      <table class="kv">${dimRows}</table>
      ${stoneRows ? `<h2>石 / Stones</h2><table><thead><tr><th>位置</th><th>カット</th><th>セッティング</th><th>径</th><th>色</th></tr></thead><tbody>${stoneRows}</tbody></table>` : ''}
      <h2>製造ルール / Tolerances</h2>
      <table class="kv">
        <tr><th>最小肉厚</th><td>${design.manufacturingRules.minWallThickness} mm</td></tr>
        <tr><th>最小穴径</th><td>${design.manufacturingRules.minHoleDiameter} mm</td></tr>
        <tr><th>アーム最小厚</th><td>${design.manufacturingRules.minBandThickness} mm</td></tr>
      </table>
    </div>
    <div>
      <h2>2D外形 / Outline</h2>
      <div class="outline">${outline}</div>
      <h2>仕上げ</h2>
      <table class="kv"><tr><th>表面</th><td>${design.patterns[0]?.type ?? '鏡面 (none)'}</td></tr>
      <tr><th>左右対称</th><td>${design.symmetry.mirrorX ? 'ON' : 'OFF'}</td></tr></table>
    </div>
  </div>

  <h2>製造チェック / QA</h2>
  <table><thead><tr><th>区分</th><th>項目</th><th>内容</th></tr></thead><tbody>${warnRows}</tbody></table>

  <footer>このシートは Atelier により自動生成されました。寸法は設計値です。鋳造収縮・研磨代は別途ご考慮ください。</footer>
  <div class="noprint" style="text-align:center;margin-top:16px;">
    <button onclick="window.print()" style="padding:8px 20px;border-radius:8px;border:0;background:#caa24a;color:#fff;font-weight:700;cursor:pointer;">PDFに印刷</button>
  </div>
</div></body></html>`;
}

function outlineSVG(design: AccessoryDesign): string {
  const p = design.params;
  let pts: { x: number; y: number }[] = [];
  let w = 40, h = 40;
  if (p.kind === 'pendant') {
    pts = buildShape(p.shape, p.width, p.height, p.cornerRadius).getPoints(80).map((v) => ({ x: v.x, y: -v.y }));
    w = p.width; h = p.height;
  } else if (p.kind === 'ring') {
    const R = p.innerDiameter / 2 + p.bandThickness;
    for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) }); }
    w = R * 2; h = R * 2;
  } else {
    pts = [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }];
  }
  const pad = 6;
  const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${(pt.x + w / 2 + pad).toFixed(2)},${(pt.y + h / 2 + pad).toFixed(2)}`).join(' ') + ' Z';
  const W = w + pad * 2, H = h + pad * 2;
  return `<svg width="220" height="${(220 * H) / W}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${W}" height="${H}" fill="none"/>
    <path d="${d}" fill="#caa24a22" stroke="#caa24a" stroke-width="0.4"/>
    <text x="${W / 2}" y="${H - 1}" font-size="2.4" fill="#999" text-anchor="middle">${w.toFixed(1)} × ${h.toFixed(1)} mm</text>
  </svg>`;
}

const sevLabel = (s: string) => (s === 'error' ? '要修正' : s === 'warning' ? '注意' : 'OK');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** 仕様書HTMLをダウンロード */
export function exportSpecSheet(design: AccessoryDesign) {
  const html = buildSpecSheetHTML(design);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(design.name || 'accessory').replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g, '_')}_仕様書.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
