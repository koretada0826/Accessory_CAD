import { nanoid } from 'nanoid';
import type { AccessoryDesign } from '@/types/accessory';

/**
 * 【自然言語 → パラメータ変更: 段階1（ルールベース）】
 *
 *  現状: 日本語キーワードを正規表現で拾い、構造JSONへ反映する決定的パーサ。
 *  将来: ここを LLM(function-calling) に差し替え、
 *        「構造JSONを入力 → 変更操作(JSON Patch)を出力」させる。
 *        出力フォーマット(ChatEditResult)は同じなので UI は無改修で差し替え可能。
 */
export interface ChatEditResult {
  reply: string;
  design: AccessoryDesign;
  changed: boolean;
  changes: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function applyChatEdit(input: string, current: AccessoryDesign): ChatEditResult {
  const text = input.trim();
  const d: AccessoryDesign = JSON.parse(JSON.stringify(current)); // 不変更新
  const changes: string[] = [];
  const p = d.params;
  const has = (...kw: string[]) => kw.some((k) => text.includes(k));

  // --- 太さ/細さ（リング幅・ワイヤー） ---
  if (has('細く', '華奢', 'スリム')) {
    if (p.kind === 'ring') {
      p.bandWidth = clamp(p.bandWidth * 0.8, 1, 12);
      changes.push(`バンド幅 → ${p.bandWidth.toFixed(1)}mm`);
    }
    if (p.kind === 'earrings') {
      p.wireDiameter = clamp(p.wireDiameter * 0.85, 0.6, 3);
      changes.push(`線径 → ${p.wireDiameter.toFixed(1)}mm`);
    }
  }
  if (has('太く', 'ボリューム', '存在感')) {
    if (p.kind === 'ring') {
      p.bandWidth = clamp(p.bandWidth * 1.25, 1, 12);
      changes.push(`バンド幅 → ${p.bandWidth.toFixed(1)}mm`);
    }
  }

  // --- 厚み ---
  if (has('厚く', '頑丈', 'しっかり')) {
    bumpThickness(d, 1.25, changes);
  }
  if (has('薄く', '軽く')) {
    bumpThickness(d, 0.8, changes);
  }

  // --- 大きさ ---
  if (has('大きく', 'でかく')) scaleSize(d, 1.2, changes);
  if (has('小さく', 'コンパクト')) scaleSize(d, 0.83, changes);

  // --- 形状（ペンダント） ---
  if (p.kind === 'pendant') {
    if (has('ハート')) { p.shape = 'heart'; changes.push('形状 → ハート'); }
    if (has('丸', 'サークル', 'コイン')) { p.shape = 'disc'; changes.push('形状 → 円形'); }
    if (has('四角', 'スクエア', 'タグ')) { p.shape = 'tag'; changes.push('形状 → タグ/角形'); }
    if (has('盾', 'シールド')) { p.shape = 'shield'; changes.push('形状 → シールド'); }
    if (has('六角', 'ヘキサ')) { p.shape = 'hexagon'; changes.push('形状 → 六角形'); }
  }

  // --- テクスチャ/雰囲気 ---
  if (has('ゴシック', '重厚', 'アンティーク')) {
    setPattern(d, 'gothic', 0.8, changes);
    if (p.kind === 'ring') p.profile = 'flat';
  }
  if (has('槌目', 'ハンマー', 'マット')) setPattern(d, 'hammered', 0.7, changes);
  if (has('つや消し', 'ブラッシュ', 'マット仕上げ')) setPattern(d, 'brushed', 0.6, changes);
  if (has('ツルツル', '鏡面', '光沢')) setPattern(d, 'none', 0, changes);

  // --- 素材 ---
  if (has('ゴールド', '金', 'イエロー')) { d.materialId = 'gold_yellow'; changes.push('素材 → イエローゴールド'); }
  if (has('シルバー', '銀')) { d.materialId = 'silver'; changes.push('素材 → シルバー'); }
  if (has('プラチナ', 'platinum')) { d.materialId = 'platinum'; changes.push('素材 → プラチナ'); }
  if (has('ピンク', 'ローズ')) { d.materialId = 'gold_rose'; changes.push('素材 → ローズゴールド'); }

  // --- 石 ---
  if (has('石を追加', '石を入れ', 'ダイヤ', 'ストーン追加', '宝石')) {
    d.stones.push({
      id: nanoid(8),
      cut: 'round',
      setting: p.kind === 'ring' ? 'prong' : 'bezel',
      diameter: 3,
      position: { x: 0, y: 0 },
      height: 1.5,
      color: '#bfe9ff',
    });
    changes.push('石を1つ追加');
    if (p.kind === 'ring' && p.top.type === 'none') p.top = { type: 'stone', width: 6, length: 6, height: 3 };
  }
  if (has('中央', '真ん中', 'センター') && d.stones.length > 0) {
    d.stones[0].position = { x: 0, y: 0 };
    changes.push('石を中央に配置');
  }
  if (has('石を大きく', '石を大きめ') && d.stones.length > 0) {
    d.stones[0].diameter = clamp(d.stones[0].diameter * 1.3, 1, 12);
    changes.push(`石径 → ${d.stones[0].diameter.toFixed(1)}mm`);
  }

  // --- リングサイズ ---
  const sizeMatch = text.match(/(\d{1,2})\s*号/);
  if (sizeMatch && p.kind === 'ring') {
    const jp = parseInt(sizeMatch[1], 10);
    p.innerDiameter = Math.round(((jp + 39) / Math.PI) * 100) / 100;
    changes.push(`リングサイズ → ${jp}号 (内径${p.innerDiameter}mm)`);
  }

  const changed = changes.length > 0;
  d.meta.origin = changed ? 'ai' : d.meta.origin;

  const reply = changed
    ? `了解しました。${changes.join(' / ')} を反映しました。`
    : 'うまく解釈できませんでした。例：「もう少し細く」「石を中央に寄せて」「13号にして」「ゴシックに」「厚く」など。';

  return { reply, design: d, changed, changes };
}

// --- ヘルパ（カテゴリ横断で厚み/サイズ/パターンを操作） ---

function bumpThickness(d: AccessoryDesign, f: number, changes: string[]) {
  const p = d.params;
  if (p.kind === 'ring') { p.bandThickness = clamp(p.bandThickness * f, 0.6, 6); changes.push(`バンド厚 → ${p.bandThickness.toFixed(1)}mm`); }
  else if (p.kind === 'pendant') { p.thickness = clamp(p.thickness * f, 0.5, 6); changes.push(`厚み → ${p.thickness.toFixed(1)}mm`); }
  else if (p.kind === 'earrings') { p.thickness = clamp(p.thickness * f, 0.5, 6); changes.push(`厚み → ${p.thickness.toFixed(1)}mm`); }
  else if (p.kind === 'bracelet') { p.thickness = clamp(p.thickness * f, 0.6, 6); changes.push(`厚み → ${p.thickness.toFixed(1)}mm`); }
}

function scaleSize(d: AccessoryDesign, f: number, changes: string[]) {
  const p = d.params;
  if (p.kind === 'pendant') { p.width = Math.round(p.width * f); p.height = Math.round(p.height * f); changes.push(`外形 → ${p.width}×${p.height}mm`); }
  else if (p.kind === 'ring' && p.top.type !== 'none') { p.top.width *= f; p.top.length *= f; changes.push('トップを拡縮'); }
  else if (p.kind === 'earrings') { p.bodyWidth = Math.round(p.bodyWidth * f); p.bodyHeight = Math.round(p.bodyHeight * f); changes.push(`本体 → ${p.bodyWidth}×${p.bodyHeight}mm`); }
}

function setPattern(d: AccessoryDesign, type: AccessoryDesign['patterns'][number]['type'], intensity: number, changes: string[]) {
  d.patterns = type === 'none' ? [] : [{ id: nanoid(6), type, intensity }];
  changes.push(`仕上げ → ${type}`);
}
