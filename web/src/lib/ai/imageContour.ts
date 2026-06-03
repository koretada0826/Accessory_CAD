/**
 * ============================================================================
 *  画像 → 輪郭抽出（ブラウザ内・インストール不要・API課金ゼロ）
 * ============================================================================
 *
 *  パイプライン:
 *    1. 縮小（最長辺 ~220px）してcanvasへ
 *    2. 背景除去 → 前景マスク（透明PNGはalpha、写真は四隅背景色との差）
 *    3. 最大連結成分を抽出（ノイズ/小領域を除去）
 *    4. Moore近傍追跡で外周輪郭を取得
 *    5. RDP（Ramer–Douglas–Peucker）で間引き
 *    6. 弧長で等間隔リサンプル + 平滑化
 *    7. 単位ボックス[-0.5,0.5]へ正規化（編集継続のため）+ mm寸法を推定
 *    8. 左右対称スコア算出（任意で対称化）
 *
 *  出力 outline は「正規化頂点列」。構造JSONの PendantParams.outline に入り、
 *  以降も幅/高さ/厚みスライダーで編集できる（= メッシュ化ではなく構造化）。
 */

export interface DetectedHole {
  /** mm（中心・外形中心基準・y-up） */
  xMm: number;
  yMm: number;
  diameterMm: number;
  /** 上部にある＝吊り穴の可能性 */
  isTop: boolean;
}

export interface ContourResult {
  /** 単位ボックス[-0.5,0.5]・y-up の正規化頂点列 */
  outline: { x: number; y: number }[];
  widthMm: number;
  heightMm: number;
  symmetric: boolean;
  symmetryScore: number;
  /** 前景に囲まれた内部穴（くり抜き）。SVGの穴/ドーナツ等 */
  holes: DetectedHole[];
  /** 元画像に重ねる輪郭プレビュー（SVG path・処理座標系） */
  overlayPath: string;
  imgW: number;
  imgH: number;
  usedAlpha: boolean;
  pointCount: number;
}

interface Pt {
  x: number;
  y: number;
}

const MAX_SIDE = 220;

export async function extractContour(
  dataUrl: string,
  opts: { targetLongestMm?: number; symmetrize?: boolean } = {}
): Promise<ContourResult | null> {
  const targetLongest = opts.targetLongestMm ?? 26;
  const { data, W, H } = await loadToImageData(dataUrl);

  const { mask, usedAlpha } = buildForegroundMask(data, W, H);
  // ノイズ低減: open(微小スペック除去)→close(微小ピンホール埋め)。
  // 半径1なので実際の内部穴(数px〜)は保持される。
  const cleaned = morphClose(morphOpen(mask, W, H), W, H);
  const comp = largestComponent(cleaned, W, H);
  if (!comp || comp.area < W * H * 0.015) return null; // 主要被写体が見つからない

  let contourPx = mooreTrace(comp.mask, W, H);
  if (contourPx.length < 12) return null;

  contourPx = rdp(contourPx, 1.6);
  contourPx = resample(contourPx, 140);
  contourPx = smooth(contourPx, 1);
  if (contourPx.length < 8) return null;

  // overlay（処理座標系 px）
  const overlayPath =
    contourPx.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';

  // bbox → 正規化 + mm
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of contourPx) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  let outline: Pt[] = contourPx.map((p) => ({
    x: (p.x - cx) / bw, // [-0.5, 0.5]
    y: -(p.y - cy) / bh, // y-up
  }));

  const symmetryScore = symmetryScoreOf(outline);
  const symmetric = symmetryScore > 0.82;
  if (opts.symmetrize && symmetric) {
    const sym = symmetrize(outline);
    if (sym) outline = sym;
  }

  const mmPerPx = targetLongest / Math.max(bw, bh);
  const widthMm = Math.round(bw * mmPerPx * 10) / 10;
  const heightMm = Math.round(bh * mmPerPx * 10) / 10;

  // 前景に囲まれた内部穴（くり抜き）を検出 → mm座標へ
  const holes: DetectedHole[] = detectEnclosedHoles(comp.mask, W, H)
    .filter((h) => h.area > Math.max(10, W * H * 0.0009))
    .map((h) => {
      const nx = (h.cx - cx) / bw;
      const ny = -(h.cy - cy) / bh;
      const isTop = h.cy < minY + bh * 0.32 && Math.abs(nx) < 0.25;
      return {
        xMm: Math.round(nx * widthMm * 10) / 10,
        yMm: Math.round(ny * heightMm * 10) / 10,
        diameterMm: Math.round(2 * Math.sqrt(h.area / Math.PI) * mmPerPx * 10) / 10,
        isTop,
      };
    });

  return {
    outline,
    widthMm,
    heightMm,
    symmetric,
    symmetryScore: Math.round(symmetryScore * 100) / 100,
    holes,
    overlayPath,
    imgW: W,
    imgH: H,
    usedAlpha,
    pointCount: outline.length,
  };
}

/**
 * 前景blobに囲まれた背景領域（=内部穴）を検出。
 * 補集合(blob外)を画像境界からflood fillし、到達しない背景画素＝囲まれた穴。
 */
function detectEnclosedHoles(comp: Uint8Array, W: number, H: number): { cx: number; cy: number; area: number }[] {
  const N = W * H;
  const visited = new Uint8Array(N); // 外側背景として到達済み
  const queue = new Int32Array(N);
  const isBg = (i: number) => comp[i] === 0;

  // 画像境界の背景画素から外側背景を塗る
  let head = 0, tail = 0;
  const pushIf = (i: number) => {
    if (isBg(i) && !visited[i]) {
      visited[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < W; x++) { pushIf(x); pushIf((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { pushIf(y * W); pushIf(y * W + (W - 1)); }
  while (head < tail) {
    const p = queue[head++];
    const x = p % W, y = (p / W) | 0;
    if (x > 0) pushIf(p - 1);
    if (x < W - 1) pushIf(p + 1);
    if (y > 0) pushIf(p - W);
    if (y < H - 1) pushIf(p + W);
  }

  // 残った背景画素（囲まれた穴）を連結成分にまとめる
  const holeLabel = new Int32Array(N);
  const holes: { cx: number; cy: number; area: number }[] = [];
  let cur = 0;
  for (let s = 0; s < N; s++) {
    if (!isBg(s) || visited[s] || holeLabel[s]) continue;
    cur++;
    let h2 = 0, t2 = 0, area = 0, sx = 0, sy = 0;
    queue[t2++] = s; holeLabel[s] = cur;
    while (h2 < t2) {
      const p = queue[h2++];
      area++; sx += p % W; sy += (p / W) | 0;
      const x = p % W, y = (p / W) | 0;
      const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
      for (const q of nb) if (q >= 0 && isBg(q) && !visited[q] && !holeLabel[q]) { holeLabel[q] = cur; queue[t2++] = q; }
    }
    holes.push({ cx: sx / area, cy: sy / area, area });
  }
  return holes;
}

// ---------------------------------------------------------------------------
// 1. 画像読み込み
// ---------------------------------------------------------------------------
function loadToImageData(dataUrl: string): Promise<{ data: Uint8ClampedArray; W: number; H: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const W = Math.max(1, Math.round(img.width * scale));
      const H = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
      if (!ctx) return reject(new Error('no 2d context'));
      ctx.drawImage(img, 0, 0, W, H);
      resolve({ data: ctx.getImageData(0, 0, W, H).data, W, H });
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = dataUrl;
  });
}

// ---------------------------------------------------------------------------
// 2. 前景マスク
// ---------------------------------------------------------------------------
function buildForegroundMask(data: Uint8ClampedArray, W: number, H: number): { mask: Uint8Array; usedAlpha: boolean } {
  const N = W * H;
  const mask = new Uint8Array(N);

  // alpha が意味を持つか
  let transparent = 0;
  for (let i = 0; i < N; i++) if (data[i * 4 + 3] < 240) transparent++;
  const usedAlpha = transparent > N * 0.03;

  if (usedAlpha) {
    for (let i = 0; i < N; i++) mask[i] = data[i * 4 + 3] > 128 ? 1 : 0;
    return { mask, usedAlpha };
  }

  // 四隅サンプルで背景色を推定
  const corners: number[][] = [];
  const grab = (x0: number, y0: number) => {
    let r = 0, g = 0, b = 0, c = 0;
    for (let y = y0; y < y0 + 6 && y < H; y++)
      for (let x = x0; x < x0 + 6 && x < W; x++) {
        const idx = (y * W + x) * 4;
        r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; c++;
      }
    corners.push([r / c, g / c, b / c]);
  };
  grab(0, 0); grab(W - 6, 0); grab(0, H - 6); grab(W - 6, H - 6);
  const bg = [0, 1, 2].map((k) => corners.reduce((s, c) => s + c[k], 0) / corners.length);

  const T = 52 * 52; // 色距離²の閾値
  for (let i = 0; i < N; i++) {
    const idx = i * 4;
    const dr = data[idx] - bg[0], dg = data[idx + 1] - bg[1], db = data[idx + 2] - bg[2];
    mask[i] = dr * dr + dg * dg + db * db > T ? 1 : 0;
  }
  return { mask, usedAlpha };
}

// ---------------------------------------------------------------------------
// 2.5 二値モルフォロジー（3x3・境界は複製）
// ---------------------------------------------------------------------------
function dilate3x3(mask: Uint8Array, W: number, H: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let dy = -1; dy <= 1 && !v; dy++) {
        const yy = Math.min(H - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(W - 1, Math.max(0, x + dx));
          if (mask[yy * W + xx]) { v = 1; break; }
        }
      }
      out[y * W + x] = v;
    }
  }
  return out;
}

function erode3x3(mask: Uint8Array, W: number, H: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 1;
      for (let dy = -1; dy <= 1 && v; dy++) {
        const yy = Math.min(H - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(W - 1, Math.max(0, x + dx));
          if (!mask[yy * W + xx]) { v = 0; break; }
        }
      }
      out[y * W + x] = v;
    }
  }
  return out;
}

/** open = erode→dilate（微小スペック除去） */
function morphOpen(mask: Uint8Array, W: number, H: number): Uint8Array {
  return dilate3x3(erode3x3(mask, W, H), W, H);
}
/** close = dilate→erode（微小ピンホール埋め・縁の滑らか化） */
function morphClose(mask: Uint8Array, W: number, H: number): Uint8Array {
  return erode3x3(dilate3x3(mask, W, H), W, H);
}

// ---------------------------------------------------------------------------
// 3. 最大連結成分（4近傍BFS）
// ---------------------------------------------------------------------------
function largestComponent(mask: Uint8Array, W: number, H: number): { mask: Uint8Array; area: number } | null {
  const N = W * H;
  const label = new Int32Array(N).fill(0);
  const queue = new Int32Array(N);
  let best = -1, bestArea = 0, cur = 0;

  for (let s = 0; s < N; s++) {
    if (mask[s] === 0 || label[s] !== 0) continue;
    cur++;
    let head = 0, tail = 0, area = 0;
    queue[tail++] = s;
    label[s] = cur;
    while (head < tail) {
      const p = queue[head++];
      area++;
      const x = p % W, y = (p / W) | 0;
      if (x > 0 && mask[p - 1] && !label[p - 1]) { label[p - 1] = cur; queue[tail++] = p - 1; }
      if (x < W - 1 && mask[p + 1] && !label[p + 1]) { label[p + 1] = cur; queue[tail++] = p + 1; }
      if (y > 0 && mask[p - W] && !label[p - W]) { label[p - W] = cur; queue[tail++] = p - W; }
      if (y < H - 1 && mask[p + W] && !label[p + W]) { label[p + W] = cur; queue[tail++] = p + W; }
    }
    if (area > bestArea) { bestArea = area; best = cur; }
  }
  if (best < 0) return null;
  const out = new Uint8Array(N);
  for (let i = 0; i < N; i++) out[i] = label[i] === best ? 1 : 0;
  return { mask: out, area: bestArea };
}

// ---------------------------------------------------------------------------
// 4. Moore近傍追跡（外周）
// ---------------------------------------------------------------------------
const DIRS = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
]; // 時計回り: N, NE, E, SE, S, SW, W, NW

function mooreTrace(mask: Uint8Array, W: number, H: number): Pt[] {
  const at = (x: number, y: number) => (x >= 0 && x < W && y >= 0 && y < H && mask[y * W + x] === 1);

  // 開始点（走査順で最初の前景）
  let sx = -1, sy = -1;
  for (let y = 0; y < H && sy < 0; y++)
    for (let x = 0; x < W; x++) if (mask[y * W + x]) { sx = x; sy = y; break; }
  if (sx < 0) return [];

  const boundary: Pt[] = [{ x: sx, y: sy }];
  let px = sx, py = sy;
  // 初期バックトラック = 西（走査の都合、左は背景）
  let bx = sx - 1, by = sy;
  const MAX = (W * H * 4) + 1000;

  for (let it = 0; it < MAX; it++) {
    // b の方向インデックス
    let di = 0;
    for (let k = 0; k < 8; k++) if (px + DIRS[k][0] === bx && py + DIRS[k][1] === by) { di = k; break; }
    // di の次から時計回りに走査
    let foundIdx = -1;
    for (let k = 1; k <= 8; k++) {
      const idx = (di + k) % 8;
      const nx = px + DIRS[idx][0], ny = py + DIRS[idx][1];
      if (at(nx, ny)) { foundIdx = idx; break; }
    }
    if (foundIdx < 0) break; // 孤立点
    const prevIdx = (foundIdx + 7) % 8; // 直前に見た背景
    bx = px + DIRS[prevIdx][0];
    by = py + DIRS[prevIdx][1];
    px = px + DIRS[foundIdx][0];
    py = py + DIRS[foundIdx][1];
    if (px === sx && py === sy) break; // 開始点に復帰
    boundary.push({ x: px, y: py });
  }
  return boundary;
}

// ---------------------------------------------------------------------------
// 5. RDP 間引き
// ---------------------------------------------------------------------------
function rdp(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length < 3) return pts;
  // 閉路なので最遠点で2分割してから適用
  let i0 = 0, i1 = 0, maxd = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = (pts[i].x - pts[0].x) ** 2 + (pts[i].y - pts[0].y) ** 2;
    if (d > maxd) { maxd = d; i1 = i; }
  }
  const a = rdpOpen(pts.slice(i0, i1 + 1), epsilon);
  const b = rdpOpen(pts.slice(i1).concat([pts[0]]), epsilon);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

function rdpOpen(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length < 3) return pts;
  let dmax = 0, index = 0;
  const end = pts.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpDist(pts[i], pts[0], pts[end]);
    if (d > dmax) { dmax = d; index = i; }
  }
  if (dmax > epsilon) {
    const left = rdpOpen(pts.slice(0, index + 1), epsilon);
    const right = rdpOpen(pts.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[end]];
}

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

// ---------------------------------------------------------------------------
// 6. 等間隔リサンプル + 平滑化
// ---------------------------------------------------------------------------
function resample(pts: Pt[], n: number): Pt[] {
  if (pts.length < 3) return pts;
  const closed = pts.concat([pts[0]]);
  let total = 0;
  const seg: number[] = [];
  for (let i = 0; i < closed.length - 1; i++) {
    const d = Math.hypot(closed[i + 1].x - closed[i].x, closed[i + 1].y - closed[i].y);
    seg.push(d); total += d;
  }
  if (total === 0) return pts;
  const step = total / n;
  const out: Pt[] = [];
  let d = 0, si = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const target = k * step;
    while (si < seg.length - 1 && acc + seg[si] < target) { acc += seg[si]; si++; }
    const t = seg[si] > 0 ? (target - acc) / seg[si] : 0;
    out.push({
      x: closed[si].x + (closed[si + 1].x - closed[si].x) * t,
      y: closed[si].y + (closed[si + 1].y - closed[si].y) * t,
    });
  }
  return out;
}

function smooth(pts: Pt[], passes: number): Pt[] {
  let cur = pts;
  for (let pass = 0; pass < passes; pass++) {
    const out: Pt[] = [];
    const n = cur.length;
    for (let i = 0; i < n; i++) {
      const a = cur[(i - 1 + n) % n], b = cur[i], c = cur[(i + 1) % n];
      out.push({ x: (a.x + 2 * b.x + c.x) / 4, y: (a.y + 2 * b.y + c.y) / 4 });
    }
    cur = out;
  }
  return cur;
}

// ---------------------------------------------------------------------------
// 8. 左右対称
// ---------------------------------------------------------------------------
function symmetryScoreOf(outline: Pt[]): number {
  let sum = 0;
  for (const p of outline) {
    const mx = -p.x, my = p.y;
    let best = Infinity;
    for (const q of outline) {
      const d = (q.x - mx) ** 2 + (q.y - my) ** 2;
      if (d < best) best = d;
    }
    sum += Math.sqrt(best);
  }
  const avg = sum / outline.length; // 単位ボックス幅~1
  return Math.max(0, 1 - avg / 0.25);
}

/** 星形（中心から各角度1交点）の場合のみ、極座標で左右対称化 */
function symmetrize(outline: Pt[]): Pt[] | null {
  const BINS = 180;
  const r: number[] = new Array(BINS).fill(-1);
  // 各角度ビンの最遠交点半径
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    sampleEdge(a, b, r, BINS);
  }
  for (let i = 0; i < BINS; i++) if (r[i] < 0) return null; // 非星形 → 諦める
  // r(θ) と r(mirror) を平均
  const out: Pt[] = [];
  for (let i = 0; i < BINS; i++) {
    const theta = (i / BINS) * Math.PI * 2;
    const mi = (BINS - i) % BINS; // x反転 = θ→π-θ
    const rr = (r[i] + r[mi]) / 2;
    out.push({ x: rr * Math.cos(theta), y: rr * Math.sin(theta) });
  }
  // 再正規化（bboxを単位ボックスへ）
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of out) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const bw = maxX - minX, bh = maxY - minY, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return out.map((p) => ({ x: (p.x - cx) / bw, y: (p.y - cy) / bh }));
}

function sampleEdge(a: Pt, b: Pt, r: number[], bins: number) {
  // エッジ上を細かくサンプルして角度ビンに半径を記録
  const steps = 8;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    let ang = Math.atan2(y, x);
    if (ang < 0) ang += Math.PI * 2;
    const bin = Math.min(bins - 1, Math.floor((ang / (Math.PI * 2)) * bins));
    const rad = Math.hypot(x, y);
    if (rad > r[bin]) r[bin] = rad;
  }
}
