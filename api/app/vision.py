"""
画像 → 構造JSON 解析（backend版・段階1: ヒューリスティック）。

現状: Pillow + numpy でアスペクト比/明度を取り、カテゴリと寸法を推定。
将来: この関数の内部を
        1) 背景除去 / セグメンテーション(U^2-Net等)
        2) 輪郭抽出(OpenCV findContours) → SVGトレース
        3) 部品認識(バチカン/石/穴/アーム) → components/stones/holes
        4) 左右対称補正
        5) 製造可能形状への補正
      に差し替える。戻り値の形(AnalyzeResult)は固定なのでAPIは無改修。
"""
from __future__ import annotations

import io
import math
import uuid
from typing import Tuple

import numpy as np
from PIL import Image

from .schema import AccessoryDesign, AnalyzeResult, DetectedFeatures


def _features(data: bytes) -> Tuple[float, float]:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    aspect = img.width / max(1, img.height)
    small = img.resize((32, 32))
    arr = np.asarray(small, dtype=np.float32) / 255.0
    luma = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    return aspect, float(luma.mean())


def analyze_image(data: bytes) -> AnalyzeResult:
    aspect, brightness = _features(data)

    if aspect > 1.7:
        category = "bracelet"
    elif aspect < 0.62:
        category = "pendant"
    elif abs(aspect - 1) < 0.18:
        category = "ring"
    else:
        category = "pendant"

    material = "silver" if brightness > 0.6 else "gold_white" if brightness > 0.4 else "gold_yellow"
    features = [f"アスペクト比 {aspect:.2f} → {category}", f"平均明度 {brightness*100:.0f}% → {material}"]

    # 最小限の構造JSON（フロントの factory と整合する形）
    if category == "ring":
        params = {"kind": "ring", "innerDiameter": 17.0, "bandWidth": 3.0,
                  "bandThickness": 1.6, "profile": "comfort",
                  "top": {"type": "none", "width": 10, "length": 12, "height": 2.5}}
        components = [{"id": uuid.uuid4().hex[:8], "type": "shank", "label": "アーム", "visible": True}]
    elif category == "bracelet":
        params = {"kind": "bracelet", "style": "plate", "plateWidth": 8, "plateLength": 32,
                  "thickness": 1.6, "linkCount": 5, "innerCircumference": 175}
        components = [{"id": uuid.uuid4().hex[:8], "type": "plate", "label": "プレート", "visible": True}]
    else:
        height = round(18 / min(1.0, aspect))
        params = {"kind": "pendant", "shape": "disc", "width": round(height * aspect),
                  "height": height, "thickness": 1.6, "cornerRadius": 3,
                  "bail": {"type": "integrated_hole", "innerDiameter": 3, "wall": 1.5}}
        components = [{"id": uuid.uuid4().hex[:8], "type": "body", "label": "本体", "visible": True}]
        features.append(f"外形 {params['width']}×{params['height']}mm を推定")

    design = AccessoryDesign(
        id=uuid.uuid4().hex[:10],
        name="AI解析デザイン",
        category=category,
        params=params,
        components=components,
        materialId=material,
        symmetry={"mirrorX": True, "mirrorY": False},
    )

    return AnalyzeResult(
        design=design,
        confidence=0.55,
        detected=DetectedFeatures(
            aspectRatio=round(aspect, 2),
            avgBrightness=round(brightness, 2),
            estimatedCategory=category,
            symmetric=True,
            features=features,
        ),
    )
