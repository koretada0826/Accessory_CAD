import { nanoid } from 'nanoid';
import type { AccessoryDesign, Warning } from '@/types/accessory';
import { MATERIALS } from '@/lib/data/materials';
import { estimateVolumeMm3 } from '@/lib/geometry';

export interface ManufacturingReport {
  warnings: Warning[];
  /** 推定重量 g */
  weightGram: number;
  /** 推定原価 円（参考） */
  costYen: number;
  /** 体積 mm^3 */
  volumeMm3: number;
  /** 3Dプリント原型に向くか */
  printable: boolean;
}

function w(
  severity: Warning['severity'],
  title: string,
  detail: string,
  target?: string,
  suggestion?: string
): Warning {
  return { id: nanoid(6), severity, title, detail, target, suggestion };
}

/**
 * 製造可能性チェック。構造JSONだけを見る純関数。
 * - 最小肉厚 / 穴径 / アーム厚 / 接続部 / プロング を検査
 * - 推定重量・原価を計算
 */
export function runManufacturingCheck(design: AccessoryDesign): ManufacturingReport {
  const warnings: Warning[] = [];
  const r = design.manufacturingRules;
  const p = design.params;

  // --- カテゴリ別の肉厚/形状チェック ---
  if (p.kind === 'ring') {
    if (p.bandThickness < r.minBandThickness) {
      warnings.push(
        w(
          'error',
          'アームが薄すぎます',
          `バンド厚 ${p.bandThickness}mm < 推奨 ${r.minBandThickness}mm。変形・破損のリスクがあります。`,
          'shank',
          `バンド厚を ${r.minBandThickness}mm 以上に`
        )
      );
    } else if (p.bandThickness < r.minBandThickness + 0.3) {
      warnings.push(w('warning', 'アームがやや細い', `バンド厚 ${p.bandThickness}mm。日常使いなら +0.3mm 推奨。`, 'shank'));
    }
    if (p.bandWidth < 1.2) {
      warnings.push(w('warning', 'バンド幅が細い', `幅 ${p.bandWidth}mm。サイズ直しが難しくなります。`, 'shank'));
    }
    if (p.profile === 'knife' && p.bandThickness < 1.4) {
      warnings.push(w('warning', 'ナイフエッジの稜線が鋭利', '稜線が欠けやすいので厚み確保を推奨。', 'shank'));
    }
    if (p.innerDiameter < 13 || p.innerDiameter > 23) {
      warnings.push(w('info', 'リングサイズが一般範囲外', `内径 ${p.innerDiameter}mm。サイズ表を確認してください。`, 'shank'));
    }
  }

  if (p.kind === 'pendant') {
    if (p.thickness < r.minWallThickness) {
      warnings.push(
        w('error', '板が薄すぎます', `厚み ${p.thickness}mm < 推奨 ${r.minWallThickness}mm。`, 'body', `厚みを ${r.minWallThickness}mm 以上に`)
      );
    }
    if (p.bail.type === 'integrated_hole') {
      if (p.bail.innerDiameter < r.minHoleDiameter) {
        warnings.push(w('warning', '吊り穴が小さい', `穴径 ${p.bail.innerDiameter}mm。チェーンが通らない可能性。`, 'bail'));
      }
      if (p.bail.wall < r.minWallThickness) {
        warnings.push(
          w('error', '吊り穴の縁が薄い', `穴上の肉 ${p.bail.wall}mm。引っ張りで切れやすい。`, 'bail', `縁の肉を ${r.minWallThickness + 0.4}mm 以上に`)
        );
      }
    }
    if (p.bail.type === 'none') {
      warnings.push(w('info', 'バチカン未設定', 'このままでは吊るせません。吊り穴かバチカンを追加してください。', 'bail'));
    }
  }

  if (p.kind === 'earrings') {
    if (p.wireDiameter < 0.7) {
      warnings.push(w('warning', 'ワイヤーが細い', `線径 ${p.wireDiameter}mm。曲がりやすい。`, 'hook'));
    }
    if (p.style !== 'hoop' && p.thickness < r.minWallThickness) {
      warnings.push(w('error', '本体が薄い', `厚み ${p.thickness}mm。`, 'stud'));
    }
  }

  if (p.kind === 'bracelet') {
    if (p.thickness < r.minWallThickness) {
      warnings.push(w('error', 'プレートが薄い', `厚み ${p.thickness}mm。`, 'plate'));
    }
    if (p.thickness * 0.8 < r.minConnectorWidth) {
      warnings.push(w('warning', '接続部が細い可能性', '連結部の強度を確認してください。', 'link'));
    }
  }

  // --- 横断: 石セッティング ---
  for (const s of design.stones) {
    if (s.setting === 'prong' && s.diameter < 1.5) {
      warnings.push(w('info', '小さな石の爪留め', `石径 ${s.diameter}mm。パヴェやレールの方が安定する場合があります。`));
    }
  }

  // --- 横断: 穴径 ---
  for (const h of design.holes) {
    if (h.diameter < r.minHoleDiameter) {
      warnings.push(w('warning', '穴が小さい', `穴 ${h.diameter}mm < ${r.minHoleDiameter}mm。`, h.id));
    }
  }

  // --- 重量・原価 ---
  const volumeMm3 = estimateVolumeMm3(design);
  const mat = MATERIALS[design.materialId];
  const weightGram = (volumeMm3 / 1000) * mat.density; // cm^3 × density
  const costYen = Math.round(weightGram * mat.costPerGram);

  // 3Dプリント原型適性（簡易）：致命エラーが無ければ可
  const printable = !warnings.some((x) => x.severity === 'error');

  if (warnings.length === 0) {
    warnings.push(w('info', '製造チェック OK', '主要な強度・穴径の問題は検出されませんでした。', undefined));
  }

  return { warnings, weightGram: Math.round(weightGram * 100) / 100, costYen, volumeMm3: Math.round(volumeMm3), printable };
}
