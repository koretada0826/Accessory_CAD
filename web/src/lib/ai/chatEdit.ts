import { nanoid } from 'nanoid';
import type { AccessoryDesign, StoneCut } from '@/types/accessory';

/**
 * 【自然言語 → パラメータ変更: 段階1（ルールベース・拡張版）】
 *
 *  日本語キーワードを拾って構造JSONへ反映する決定的パーサ。
 *  色/石種/カット/刻印/素材/プロファイル/バチカン/トップ/数値指定に対応。
 *  将来は LLM(function-calling) に差し替え（出力 ChatEditResult は固定なのでUI無改修）。
 */
export interface ChatEditResult {
  reply: string;
  design: AccessoryDesign;
  changed: boolean;
  changes: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// 石/色のキーワード → 色
const GEM_NOUNS = ['ルビー', 'サファイア', 'エメラルド', 'ダイヤ', 'ダイアモンド', 'アメジスト', 'シトリン', 'オニキス', 'アクアマリン', 'トパーズ', 'ガーネット', 'パール', '真珠'];
const COLOR_MAP: { kw: string[]; color: string }[] = [
  { kw: ['ルビー', 'ガーネット', '赤', 'レッド'], color: '#e0234e' },
  { kw: ['サファイア', '青', 'ブルー', '紺'], color: '#1f6fe0' },
  { kw: ['エメラルド', '緑', 'グリーン'], color: '#19a05a' },
  { kw: ['ダイヤ', 'ダイアモンド', '透明', 'クリア'], color: '#eaf6ff' },
  { kw: ['アメジスト', '紫', 'パープル'], color: '#9b59d0' },
  { kw: ['ローズクォーツ', '桃色'], color: '#ff9ec4' },
  { kw: ['アクアマリン', '水色', 'スカイ'], color: '#7fd4ff' },
  { kw: ['シトリン', 'トパーズ', '黄', 'イエロー'], color: '#ffd34d' },
  { kw: ['オニキス', '黒', 'ブラック'], color: '#23232a' },
  { kw: ['パール', '真珠'], color: '#f3eee4' },
];

const CUT_MAP: { kw: string[]; cut: StoneCut }[] = [
  { kw: ['ラウンド', '丸カット'], cut: 'round' },
  { kw: ['オーバル', '楕円カット'], cut: 'oval' },
  { kw: ['プリンセス', 'スクエアカット'], cut: 'princess' },
  { kw: ['ペアシェイプ', 'ペア', '雫', 'しずく'], cut: 'pear' },
  { kw: ['マーキス'], cut: 'marquise' },
  { kw: ['カボション', 'ドーム型'], cut: 'cabochon' },
];

export function applyChatEdit(input: string, current: AccessoryDesign): ChatEditResult {
  const text = input.trim();
  const d: AccessoryDesign = JSON.parse(JSON.stringify(current));
  const changes: string[] = [];
  const p = d.params;
  const has = (...kw: string[]) => kw.some((k) => text.includes(k));
  const num = (re: RegExp) => {
    const m = text.match(re);
    return m ? parseFloat(m[1]) : null;
  };

  const ensureStone = () => {
    if (d.stones.length === 0) {
      d.stones.push({ id: nanoid(8), cut: 'round', setting: p.kind === 'ring' ? 'prong' : 'bezel', diameter: 3, position: { x: 0, y: 0 }, height: 1.5, color: '#bfe9ff' });
      if (p.kind === 'ring' && p.top.type === 'none') p.top = { type: 'stone', width: 6, length: 6, height: 3 };
    }
  };

  // --- 太さ/細さ ---
  if (has('細く', '華奢', 'スリム')) {
    if (p.kind === 'ring') { p.bandWidth = clamp(p.bandWidth * 0.8, 1, 12); changes.push(`バンド幅 → ${p.bandWidth.toFixed(1)}mm`); }
    if (p.kind === 'earrings') { p.wireDiameter = clamp(p.wireDiameter * 0.85, 0.6, 3); changes.push(`線径 → ${p.wireDiameter.toFixed(1)}mm`); }
  }
  if (has('太く', 'ボリューム', '存在感', 'ごつく')) {
    if (p.kind === 'ring') { p.bandWidth = clamp(p.bandWidth * 1.25, 1, 12); changes.push(`バンド幅 → ${p.bandWidth.toFixed(1)}mm`); }
  }

  // --- 厚み ---
  if (has('厚く', '頑丈', 'しっかり', 'ぶ厚')) bumpThickness(d, 1.25, changes);
  if (has('薄く', '軽く', 'スマート')) bumpThickness(d, 0.8, changes);

  // --- 大きさ ---
  if (has('大きく', 'でかく', '大きめ')) scaleSize(d, 1.2, changes);
  if (has('小さく', 'コンパクト', '小ぶり')) scaleSize(d, 0.83, changes);

  // --- 数値の絶対指定 ---
  const wMm = num(/幅(?:を)?\s*([\d.]+)\s*(?:mm|ミリ)?/);
  if (wMm) { if (p.kind === 'pendant') { p.width = clamp(wMm, 6, 60); changes.push(`幅 → ${p.width}mm`); } else if (p.kind === 'earrings') { p.bodyWidth = clamp(wMm, 3, 25); changes.push(`本体幅 → ${p.bodyWidth}mm`); } }
  const hMm = num(/(?:高さ|たて|縦)(?:を)?\s*([\d.]+)\s*(?:mm|ミリ)?/);
  if (hMm) { if (p.kind === 'pendant') { p.height = clamp(hMm, 6, 60); changes.push(`高さ → ${p.height}mm`); } }
  const tMm = num(/厚[みさ](?:を)?\s*([\d.]+)\s*(?:mm|ミリ)?/);
  if (tMm) { setThickness(d, tMm, changes); }

  // --- リングサイズ ---
  const jp = num(/(\d{1,2})\s*号/);
  if (jp && p.kind === 'ring') { p.innerDiameter = Math.round(((jp + 39) / Math.PI) * 100) / 100; changes.push(`リングサイズ → ${jp}号 (内径${p.innerDiameter}mm)`); }

  // --- 形状（ペンダント） ---
  if (p.kind === 'pendant') {
    if (has('ハート')) { p.shape = 'heart'; changes.push('形状 → ハート'); }
    if (has('丸', 'サークル', 'コイン', '円形')) { p.shape = 'disc'; changes.push('形状 → 円形'); }
    if (has('楕円', 'オーバル')) { p.shape = 'oval'; changes.push('形状 → 楕円'); }
    if (has('四角', 'スクエア', 'タグ', '長方形')) { p.shape = 'tag'; changes.push('形状 → タグ/角形'); }
    if (has('盾', 'シールド')) { p.shape = 'shield'; changes.push('形状 → シールド'); }
    if (has('六角', 'ヘキサ')) { p.shape = 'hexagon'; changes.push('形状 → 六角形'); }
  }

  // --- リング: プロファイル / トップ ---
  if (p.kind === 'ring') {
    if (has('平打', 'フラット')) { p.profile = 'flat'; changes.push('断面 → 平打'); }
    if (has('甲丸', 'かまぼこ', 'コンフォート')) { p.profile = 'comfort'; changes.push('断面 → 甲丸'); }
    if (has('ナイフ', '稜線')) { p.profile = 'knife'; changes.push('断面 → ナイフ'); }
    if (has('丸断面', '丸みのある断面', 'ラウンド断面')) { p.profile = 'round'; changes.push('断面 → 丸'); }
    if (has('印台', 'シグネット')) { p.top = { type: 'signet', width: 11, length: 13, height: 2.6 }; changes.push('トップ → 印台'); }
    if (has('ドーム')) { p.top = { type: 'dome', width: 10, length: 10, height: 4 }; changes.push('トップ → ドーム'); }
  }

  // --- 仕上げ ---
  if (has('ゴシック', '重厚', 'アンティーク')) { setPattern(d, 'gothic', 0.8, changes); if (p.kind === 'ring') p.profile = 'flat'; }
  if (has('槌目', 'ハンマー', 'ハンマード')) setPattern(d, 'hammered', 0.7, changes);
  if (has('つや消し', 'ブラッシュ', 'マット')) setPattern(d, 'brushed', 0.6, changes);
  if (has('ツルツル', '鏡面', '光沢', 'ピカピカ')) setPattern(d, 'none', 0, changes);

  // --- 素材（全種） ---
  if (has('イエローゴールド', '金色', 'ゴールド') && !has('ホワイト', 'ピンク', 'ローズ')) { d.materialId = 'gold_yellow'; changes.push('素材 → イエローゴールド'); }
  if (has('ホワイトゴールド', 'WG')) { d.materialId = 'gold_white'; changes.push('素材 → ホワイトゴールド'); }
  if (has('ローズゴールド', 'ピンクゴールド', 'ピンク色')) { d.materialId = 'gold_rose'; changes.push('素材 → ローズゴールド'); }
  if (has('シルバー', '銀')) { d.materialId = 'silver'; changes.push('素材 → シルバー'); }
  if (has('プラチナ', 'platinum', 'pt')) { d.materialId = 'platinum'; changes.push('素材 → プラチナ'); }
  if (has('真鍮', 'ブラス')) { d.materialId = 'brass'; changes.push('素材 → 真鍮'); }
  if (has('ステンレス', 'サージカル')) { d.materialId = 'steel'; changes.push('素材 → ステンレス'); }
  if (has('樹脂', 'レジン', 'プラ')) { d.materialId = 'resin'; changes.push('素材 → 樹脂'); }

  // --- 石: 追加 / 削除 / 数 / 中央 / 大きさ / 色 / カット ---
  if (has('石を追加', '石を入れ', '石追加', 'ストーン追加', '宝石を') || GEM_NOUNS.some((g) => text.includes(g) && has('入れ', '追加', 'にして', 'つけ'))) {
    ensureStone();
    changes.push('石を追加');
  }
  if (has('石を消', '石を削除', '石を取', '石をなく', 'ストーンを消') && d.stones.length > 0) { d.stones.pop(); changes.push('石を削除'); }
  const stoneCount = num(/石を?\s*(\d)\s*[個粒つ]/);
  if (stoneCount !== null && p.kind !== 'generic') {
    const n = clamp(stoneCount, 0, 7);
    while (d.stones.length < n) ensureStone(), d.stones[d.stones.length - 1].position = { x: (d.stones.length - 1) * 3 - 3, y: 0 };
    while (d.stones.length > n) d.stones.pop();
    changes.push(`石を${n}個に`);
  }
  if (has('中央', '真ん中', 'センター') && d.stones.length > 0) { d.stones[0].position = { x: 0, y: 0 }; changes.push('石を中央に配置'); }
  if (has('石を大きく', '石を大きめ', '大きい石') && d.stones.length > 0) { d.stones[0].diameter = clamp(d.stones[0].diameter * 1.3, 1, 12); changes.push(`石径 → ${d.stones[0].diameter.toFixed(1)}mm`); }
  if (has('石を小さく', '小さい石') && d.stones.length > 0) { d.stones[0].diameter = clamp(d.stones[0].diameter * 0.77, 1, 12); changes.push(`石径 → ${d.stones[0].diameter.toFixed(1)}mm`); }

  // 石の色（宝石名 or 石+色）
  const gemMentioned = GEM_NOUNS.some((g) => text.includes(g));
  const colorHit = COLOR_MAP.find((c) => c.kw.some((k) => text.includes(k)));
  if (colorHit && (gemMentioned || has('石', 'ストーン', '宝石') || d.stones.length > 0)) {
    if (gemMentioned || has('石', 'ストーン', '宝石')) ensureStone();
    if (d.stones.length > 0) { d.stones[0].color = colorHit.color; changes.push(`石の色を変更`); }
  }
  // 石のカット
  const cutHit = CUT_MAP.find((c) => c.kw.some((k) => text.includes(k)));
  if (cutHit && (d.stones.length > 0 || gemMentioned)) { ensureStone(); d.stones[0].cut = cutHit.cut; changes.push(`カット → ${cutHit.cut}`); }
  // 留め方
  if (has('覆輪', 'ベゼル', 'フチ留め') && d.stones.length > 0) { d.stones[0].setting = 'bezel'; changes.push('留め → ベゼル'); }
  if (has('爪留め', 'プロング') && d.stones.length > 0) { d.stones[0].setting = 'prong'; changes.push('留め → 爪'); }

  // --- バチカン（ペンダント） ---
  if (p.kind === 'pendant') {
    if (has('丸カン', '丸環')) { p.bail.type = 'ring_bail'; changes.push('バチカン → 丸カン'); }
    if (has('チューブ', '筒')) { p.bail.type = 'tube'; changes.push('バチカン → チューブ'); }
    if (has('吊り穴', '穴を開け', '穴あけ')) { p.bail.type = 'integrated_hole'; changes.push('バチカン → 吊り穴'); }
  }

  // --- 刻印 / 名入れ ---
  if (p.kind === 'pendant') {
    if (has('刻印を消', '刻印を削除', '名入れを消')) { d.engraving = []; changes.push('刻印を削除'); }
    const eng = extractEngraving(text);
    if (eng) {
      if (d.engraving.length > 0) { d.engraving[0].text = eng; }
      else d.engraving.push({ id: nanoid(8), text: eng, size: 4, depth: -0.4, position: { x: 0, y: 0 }, font: 'serif' });
      changes.push(`刻印 → 「${eng}」`);
    }
    if (has('凸', '浮き彫り', 'エンボス') && d.engraving.length > 0) { d.engraving[0].depth = 0.4; changes.push('刻印 → 凸(浮き)'); }
    if (has('凹', '彫り込み', '彫って') && d.engraving.length > 0) { d.engraving[0].depth = -0.4; changes.push('刻印 → 凹(彫り)'); }
  }

  const changed = changes.length > 0;
  d.meta.origin = changed ? 'ai' : d.meta.origin;

  const reply = changed
    ? `了解しました。${changes.join(' / ')} を反映しました。`
    : 'うまく解釈できませんでした。例：「サファイアを入れて」「13号にして」「"LOVE"と刻んで」「ホワイトゴールドに」「ハートにして」「もっと細く」など。';

  return { reply, design: d, changed, changes };
}

// --- 刻印テキスト抽出 ---
function extractEngraving(text: string): string | null {
  // 引用符
  const q = text.match(/[「『"”']([^」』"”']{1,20})[」』"”']/);
  if (q) return q[1].trim();
  // 「XXXと刻んで/刻印」
  const m1 = text.match(/([A-Za-z0-9&.\- ]{2,20})\s*(?:と|を)?\s*(?:刻[んむみ]|刻印|彫って|名入れ)/);
  if (m1) return m1[1].trim();
  // 「刻印/名入れ XXX」
  const m2 = text.match(/(?:刻印|名入れ)\s*[:：]?\s*([A-Za-z0-9&.\- ]{2,20})/);
  if (m2) return m2[1].trim();
  return null;
}

// --- ヘルパ ---
function setThickness(d: AccessoryDesign, v: number, changes: string[]) {
  const p = d.params;
  if (p.kind === 'ring') { p.bandThickness = clamp(v, 0.6, 6); changes.push(`バンド厚 → ${p.bandThickness}mm`); }
  else if (p.kind === 'pendant') { p.thickness = clamp(v, 0.5, 6); changes.push(`厚み → ${p.thickness}mm`); }
  else if (p.kind === 'earrings') { p.thickness = clamp(v, 0.5, 6); changes.push(`厚み → ${p.thickness}mm`); }
  else if (p.kind === 'bracelet') { p.thickness = clamp(v, 0.6, 6); changes.push(`厚み → ${p.thickness}mm`); }
}

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
