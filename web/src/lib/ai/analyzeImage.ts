import { nanoid } from 'nanoid';
import type { AccessoryDesign, Category } from '@/types/accessory';
import { createDesign } from '@/lib/data/factory';
import { extractContour } from './imageContour';

/**
 * 画像 → 構造JSON 解析の結果。
 * 信頼度や検出フィーチャを併せて返すことで、UIで「AIが何を読んだか」を見せられる。
 */
export interface AnalyzeResult {
  design: AccessoryDesign;
  confidence: number; // 0..1
  detected: {
    aspectRatio: number;
    avgBrightness: number;
    estimatedCategory: Category;
    symmetric: boolean;
    features: string[];
    /** 輪郭プレビュー（元画像に重ねるSVG path・処理座標系）。トレース成功時のみ */
    overlayPath?: string;
    imgW?: number;
    imgH?: number;
  };
}

/**
 * 【画像→構造化パイプライン: 段階2（輪郭抽出）】
 *
 *  ペンダント/チャート系は実際に輪郭を抽出して「カスタム外形」に変換する。
 *  リング/ブレスレットは正面性が低い/別構造のため、現状は寸法ヒューリスティック。
 *
 *  将来: backend(OpenCV/segmentation)で
 *        部品認識（バチカン/石/穴）・製造可能形状補正 まで拡張（戻り値形は固定）。
 */
export async function analyzeImage(dataUrl: string): Promise<AnalyzeResult> {
  const { aspectRatio, avgBrightness } = await extractImageFeatures(dataUrl);

  // カテゴリ推定（簡易ヒューリスティック）
  let category: Category;
  if (aspectRatio > 1.8) category = 'bracelet';
  else if (Math.abs(aspectRatio - 1) < 0.16 && avgBrightness < 0.7) category = 'ring';
  else category = 'pendant';

  const features: string[] = [];
  features.push(`アスペクト比 ${aspectRatio.toFixed(2)}`);

  // --- ペンダント系: 実輪郭トレース ---
  if (category === 'pendant') {
    const contour = await extractContour(dataUrl, { targetLongestMm: 26, symmetrize: true });
    if (contour) {
      const design = createDesign('pendant', '画像トレース ペンダント');
      design.meta.origin = 'image';
      design.meta.sourceImage = dataUrl;
      design.symmetry.mirrorX = contour.symmetric;
      design.materialId = avgBrightness > 0.6 ? 'silver' : avgBrightness > 0.4 ? 'gold_white' : 'gold_yellow';

      if (design.params.kind === 'pendant') {
        design.params.shape = 'custom';
        design.params.outline = contour.outline;
        design.params.width = contour.widthMm;
        design.params.height = contour.heightMm;
        design.params.thickness = 1.6;
        design.params.cornerRadius = 0;
        design.params.bail = { type: 'integrated_hole', innerDiameter: 3, wall: 1.6 };

        // 検出した内部穴（くり抜き）を反映
        const topHole = contour.holes.find((h) => h.isTop);
        for (const h of contour.holes) {
          design.holes.push({
            id: nanoid(8),
            role: 'decoration',
            diameter: h.diameterMm,
            position: { x: h.xMm, y: h.yMm },
          });
        }
        // 上部の穴があれば、それを吊り穴として使う（合成バチカンは無効化）
        if (topHole) design.params.bail.type = 'none';

        // 検出した石を反映
        for (const st of contour.stones) {
          design.stones.push({
            id: nanoid(8),
            cut: 'round',
            setting: 'bezel',
            diameter: st.diameterMm,
            position: { x: st.xMm, y: st.yMm },
            height: st.diameterMm * 0.4,
            color: st.color,
          });
        }
      }

      features.push(`輪郭 ${contour.pointCount}点を抽出${contour.usedAlpha ? '（透過PNG）' : ''}`);
      features.push(`外形 ${contour.widthMm}×${contour.heightMm}mm を推定`);
      features.push(contour.symmetric ? `左右対称を検出（補正適用 / score ${contour.symmetryScore}）` : `非対称形状（score ${contour.symmetryScore}）`);
      if (contour.holes.length > 0) {
        const topHole = contour.holes.find((h) => h.isTop);
        features.push(`内部穴 ${contour.holes.length}個を検出${topHole ? '（上部を吊り穴と判定）' : ''}`);
      } else {
        features.push('上部に吊り穴を自動配置');
      }
      if (contour.stones.length > 0) {
        features.push(`石 ${contour.stones.length}個を検出（色・位置・サイズを推定）`);
      }

      return {
        design,
        confidence: 0.72,
        detected: {
          aspectRatio: round2(aspectRatio),
          avgBrightness: round2(avgBrightness),
          estimatedCategory: 'pendant',
          symmetric: contour.symmetric,
          features,
          overlayPath: contour.overlayPath,
          imgW: contour.imgW,
          imgH: contour.imgH,
        },
      };
    }
    // トレース失敗 → ヒューリスティックの円形へフォールバック
    features.push('輪郭抽出に失敗 → 円形で近似（背景がはっきりした画像だと精度向上）');
  }

  // --- フォールバック / リング・ブレスレット ---
  const design = createDesign(category, 'AI解析デザイン');
  design.meta.origin = 'image';
  design.meta.sourceImage = dataUrl;
  design.materialId = avgBrightness > 0.6 ? 'silver' : avgBrightness > 0.4 ? 'gold_white' : 'gold_yellow';

  if (design.params.kind === 'pendant') {
    design.params.height = Math.round(18 / Math.min(1, aspectRatio));
    design.params.width = Math.round(design.params.height * aspectRatio);
    features.push(`外形 ${design.params.width}×${design.params.height}mm を推定`);
  } else if (design.params.kind === 'ring') {
    features.push('正面画像とみなし内径17mmを初期設定');
  } else if (design.params.kind === 'bracelet') {
    features.push('横長 → プレートブレスレットとして解釈');
  }

  return {
    design,
    confidence: 0.5,
    detected: {
      aspectRatio: round2(aspectRatio),
      avgBrightness: round2(avgBrightness),
      estimatedCategory: category,
      symmetric: true,
      features,
    },
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** canvas で画像の簡易特徴量（アスペクト比・平均明度）を取る */
function extractImageFeatures(dataUrl: string): Promise<{ aspectRatio: number; avgBrightness: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      const size = 32;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve({ aspectRatio, avgBrightness: 0.5 });
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      }
      resolve({ aspectRatio, avgBrightness: sum / (size * size) });
    };
    img.onerror = () => resolve({ aspectRatio: 1, avgBrightness: 0.5 });
    img.src = dataUrl;
  });
}
