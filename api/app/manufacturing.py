"""
製造チェック & 体積/重量推定（フロントの check.ts と同等のヒューリスティックの Python 版）。

フロント単体でも同じ計算をするが、backend 側でも提供することで
バッチ処理・見積もりAPI・将来の厳密FEM等への発展余地を残す。
"""
from __future__ import annotations

import math
import uuid
from typing import Dict

from .schema import AccessoryDesign, ManufacturingReport, Warning

# 素材密度(g/cm^3) と 参考原価(円/g)
MATERIALS: Dict[str, Dict[str, float]] = {
    "gold_yellow": {"density": 15.6, "cost": 9000},
    "gold_white": {"density": 15.7, "cost": 9200},
    "gold_rose": {"density": 15.2, "cost": 9000},
    "silver": {"density": 10.4, "cost": 120},
    "platinum": {"density": 21.4, "cost": 4800},
    "brass": {"density": 8.5, "cost": 5},
    "steel": {"density": 7.9, "cost": 3},
    "resin": {"density": 1.2, "cost": 2},
}


def _w(severity: str, title: str, detail: str, target=None, suggestion=None) -> Warning:
    return Warning(
        id=uuid.uuid4().hex[:6],
        severity=severity,
        title=title,
        detail=detail,
        target=target,
        suggestion=suggestion,
    )


def estimate_volume_mm3(design: AccessoryDesign) -> float:
    p = design.params
    kind = p.get("kind")
    if kind == "ring":
        inner = p.get("innerDiameter", 17.0)
        t = p.get("bandThickness", 1.6)
        wid = p.get("bandWidth", 3.0)
        center_r = inner / 2 + t / 2
        circ = 2 * math.pi * center_r
        area = t * wid
        prof = p.get("profile", "flat")
        if prof == "round":
            area *= math.pi / 4
        if prof == "knife":
            area *= 0.5
        v = area * circ
        top = p.get("top", {})
        if top.get("type") == "signet":
            v += top.get("width", 10) * top.get("length", 12) * top.get("height", 2.5) * 0.85
        return v
    if kind == "pendant":
        shape = p.get("shape", "disc")
        w = p.get("width", 18)
        h = p.get("height", 18)
        th = p.get("thickness", 1.6)
        factor = math.pi / 4 if shape in ("disc", "oval") else 0.7 if shape == "heart" else 0.92
        area = w * h * factor
        bail = p.get("bail", {})
        if bail.get("type") == "integrated_hole":
            area -= math.pi * (bail.get("innerDiameter", 3) / 2) ** 2
        return max(0.0, area) * th
    if kind == "earrings":
        if p.get("style") == "hoop":
            R = p.get("hoopDiameter", 16) / 2
            return math.pi * (p.get("wireDiameter", 1) / 2) ** 2 * (2 * math.pi * R)
        return p.get("bodyWidth", 8) * p.get("bodyHeight", 8) * p.get("thickness", 1.4) * 0.9
    if kind == "bracelet":
        v = p.get("plateWidth", 8) * p.get("plateLength", 32) * p.get("thickness", 1.6)
        v += p.get("linkCount", 5) * 2 * (5 * p.get("plateWidth", 8) * 0.7 * p.get("thickness", 1.6) * 0.8)
        return v
    return p.get("width", 16) * p.get("height", 10) * p.get("thickness", 1.6)


def run_check(design: AccessoryDesign) -> ManufacturingReport:
    warnings = []
    r = design.manufacturingRules
    p = design.params
    kind = p.get("kind")

    if kind == "ring":
        if p.get("bandThickness", 1.6) < r.minBandThickness:
            warnings.append(_w("error", "アームが薄すぎます",
                               f"バンド厚 {p.get('bandThickness')}mm < 推奨 {r.minBandThickness}mm",
                               "shank", f"バンド厚を {r.minBandThickness}mm 以上に"))
        if p.get("bandWidth", 3) < 1.2:
            warnings.append(_w("warning", "バンド幅が細い", f"幅 {p.get('bandWidth')}mm", "shank"))
    elif kind == "pendant":
        if p.get("thickness", 1.6) < r.minWallThickness:
            warnings.append(_w("error", "板が薄すぎます",
                               f"厚み {p.get('thickness')}mm < 推奨 {r.minWallThickness}mm", "body"))
        bail = p.get("bail", {})
        if bail.get("type") == "integrated_hole" and bail.get("wall", 1.5) < r.minWallThickness:
            warnings.append(_w("error", "吊り穴の縁が薄い", f"縁の肉 {bail.get('wall')}mm", "bail"))
        if bail.get("type") == "none":
            warnings.append(_w("info", "バチカン未設定", "吊り穴かバチカンを追加してください", "bail"))

    for h in design.holes:
        if h.diameter < r.minHoleDiameter:
            warnings.append(_w("warning", "穴が小さい", f"穴 {h.diameter}mm < {r.minHoleDiameter}mm", h.id))

    vol = estimate_volume_mm3(design)
    mat = MATERIALS.get(design.materialId, MATERIALS["silver"])
    weight = (vol / 1000.0) * mat["density"]
    cost = round(weight * mat["cost"])
    printable = not any(x.severity == "error" for x in warnings)

    if not warnings:
        warnings.append(_w("info", "製造チェック OK", "主要な問題は検出されませんでした"))

    return ManufacturingReport(
        warnings=warnings,
        weightGram=round(weight, 2),
        costYen=cost,
        volumeMm3=round(vol),
        printable=printable,
    )
