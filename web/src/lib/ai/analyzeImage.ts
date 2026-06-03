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

  // カテゴリ推定: 横長→ブレスレット、それ以外はトレースして「中央に大きな穴=環状」なら
  // リング、そうでなければペンダントと判定する（リング/ペンダントは輪郭トレースで決める）。
  const category: Category = aspectRatio > 1.8 ? 'bracelet' : 'pendant';

  const features: string[] = [];
  features.push(`アスペクト比 ${aspectRatio.toFixed(2)}`);

  // --- ペンダント系 + リング: 実輪郭トレース ---
  if (category === 'pendant') {
    const contour = await extractContour(dataUrl, { targetLongestMm: 26, symmetrize: true });
    if (contour) {
      // 中央に大きな穴 → 環状（リング）と判定し Ring に変換
      const minSide = Math.min(contour.widthMm, contour.heightMm);
      const central = contour.holes.find(
        (h) =>
          Math.abs(h.xMm) < contour.widthMm * 0.2 &&
          Math.abs(h.yMm) < contour.heightMm * 0.2 &&
          h.diameterMm > minSide * 0.42
      );
      if (central) {
        const ring = createDesign('ring', '画像トレース リング');
        ring.meta.origin = 'image';
        ring.meta.sourceImage = dataUrl;
        ring.materialId = avgBrightness > 0.6 ? 'silver' : avgBrightness > 0.4 ? 'gold_white' : 'gold_yellow';
        const outerD = (contour.widthMm + contour.heightMm) / 2;
        if (ring.params.kind === 'ring') {
          ring.params.innerDiameter = Math.round(central.diameterMm * 100) / 100;
          ring.params.bandThickness = Math.max(1, Math.round(((outerD - central.diameterMm) / 2) * 10) / 10);
          ring.params.bandWidth = 3;
          ring.params.profile = 'flat';
        }
        features.push(`環状を検出 → リングと判定`);
        features.push(`内径 ${ring.params.kind === 'ring' ? ring.params.innerDiameter : ''}mm / 外径 ${Math.round(outerD)}mm を推定`);
        features.push('※ バンド幅(厚み方向)は俯瞰画像から不明のため初期値');
        return {
          design: ring,
          confidence: 0.6,
          detected: {
            aspectRatio: round2(aspectRatio),
            avgBrightness: round2(avgBrightness),
            estimatedCategory: 'ring',
            symmetric: true,
            features,
            overlayPath: contour.overlayPath,
            imgW: contour.imgW,
            imgH: contour.imgH,
          },
        };
      }
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

        // 検出した内部穴（くり抜き）を反映。上部の穴は吊り穴(bail)として扱う
        const topHole = contour.holes.find((h) => h.isTop);
        for (const h of contour.holes) {
          design.holes.push({
            id: nanoid(8),
            role: h.isTop ? 'bail' : 'decoration',
            diameter: h.diameterMm,
            position: { x: h.xMm, y: h.yMm },
          });
        }
        if (topHole) {
          // 上部の穴があれば、それを吊り穴として使う（合成バチカンは無効化）
          design.params.bail.type = 'none';
        } else if (contour.bail) {
          // 上部の突起をバチカンと判定。外形に既に含まれるため別途トーラスは足さず、
          // ループ中心に通し穴(role=bail)を開けて実際に通せる輪にする。
          design.params.bail.type = 'none';
          design.params.bail.innerDiameter = contour.bail.innerDiameterMm;
          design.holes.push({
            id: nanoid(8),
            role: 'bail',
            diameter: contour.bail.innerDiameterMm,
            position: { x: contour.bail.xMm, y: contour.bail.yMm },
          });
        }

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
        if (!topHole && contour.bail) {
          features.push(`上部の突起をバチカン（${contour.bail.type === 'ring_bail' ? '丸カン' : 'チューブ'}）と判定→通し穴を配置`);
        }
      } else if (contour.bail) {
        features.push(`上部の突起をバチカン（${contour.bail.type === 'ring_bail' ? '丸カン' : 'チューブ'}）と判定→通し穴を配置`);
      } else {
        features.push('上部に吊り穴を自動配置');
      }
      if (contour.stones.length > 0) {
        features.push(`石 ${contour.stones.length}個を検出（色・位置・サイズを推定）`);
      }
      if (contour.correctedCorners > 0) {
        features.push(`鋭利な角 ${contour.correctedCorners}箇所を製造向けに面取り`);
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
