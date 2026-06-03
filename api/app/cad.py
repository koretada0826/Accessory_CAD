"""
厳密ソリッド生成 & STEP出力。

CadQuery(OpenCascade) が入っていれば Ring / Pendant の STEP を生成する。
未導入なら 501 相当を呼び出し側に返せるよう CadQueryUnavailable を投げる。

※ ブラウザ側の近似メッシュ(geometry/*.ts)と「同じ構造JSON」から生成するため、
  プレビューと製造データの設計意図が一致する。
"""
from __future__ import annotations

import io
import math

from .schema import AccessoryDesign

try:
    import cadquery as cq  # type: ignore

    HAS_CADQUERY = True
except Exception:  # pragma: no cover - 任意依存
    HAS_CADQUERY = False


class CadQueryUnavailable(RuntimeError):
    pass


def build_step(design: AccessoryDesign) -> bytes:
    """構造JSON → STEP(bytes)。CadQuery 必須。"""
    if not HAS_CADQUERY:
        raise CadQueryUnavailable(
            "STEP出力には CadQuery が必要です。`pip install cadquery` を実行してください。"
        )

    p = design.params
    kind = p.get("kind")

    if kind == "ring":
        solid = _ring(p)
    elif kind == "pendant":
        solid = _pendant(p)
    else:
        # 汎用フォールバック: 角丸ボックス
        w = p.get("width", 16)
        h = p.get("height", 10)
        t = p.get("thickness", 1.6)
        solid = cq.Workplane("XY").box(w, h, t)

    buf = io.BytesIO()
    cq.exporters.export(solid, buf, exportType="STEP")  # type: ignore
    return buf.getvalue()


def _ring(p) -> "cq.Workplane":  # type: ignore
    inner_r = p.get("innerDiameter", 17.0) / 2
    t = p.get("bandThickness", 1.6)
    width = p.get("bandWidth", 3.0)
    outer_r = inner_r + t
    # 円筒差分でバンドを作る
    band = (
        cq.Workplane("XY")
        .circle(outer_r)
        .circle(inner_r)
        .extrude(width)
        .translate((0, 0, -width / 2))
    )
    top = p.get("top", {})
    if top.get("type") == "signet":
        plate = (
            cq.Workplane("XY")
            .box(top.get("width", 10), top.get("length", 12), top.get("height", 2.5))
            .translate((0, outer_r + top.get("height", 2.5) / 2 - 0.4, 0))
        )
        band = band.union(plate)
    return band


def _pendant(p) -> "cq.Workplane":  # type: ignore
    shape = p.get("shape", "disc")
    w = p.get("width", 18)
    h = p.get("height", 18)
    t = p.get("thickness", 1.6)
    if shape in ("disc", "oval"):
        wp = cq.Workplane("XY").ellipse(w / 2, h / 2)
    else:
        wp = cq.Workplane("XY").rect(w, h)
    body = wp.extrude(t)

    bail = p.get("bail", {})
    if bail.get("type") == "integrated_hole":
        d = bail.get("innerDiameter", 3)
        wall = bail.get("wall", 1.5)
        hole_y = h / 2 - wall - d / 2
        hole = cq.Workplane("XY").moveTo(0, hole_y).circle(d / 2).extrude(t * 3).translate((0, 0, -t))
        body = body.cut(hole)
    return body
