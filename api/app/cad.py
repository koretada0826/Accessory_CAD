"""
厳密ソリッド生成 & STEP出力。

CadQuery(OpenCascade) が入っていれば Ring / Pendant の STEP を生成する。
未導入なら 501 相当を呼び出し側に返せるよう CadQueryUnavailable を投げる。

※ ブラウザ側の近似メッシュ(geometry/*.ts)と「同じ構造JSON」から生成するため、
  プレビューと製造データの設計意図が一致する。
"""
from __future__ import annotations

import math
import os
import tempfile

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

    # CadQuery の STEP 書き出しはファイル名必須（BytesIO 不可）のため一時ファイル経由
    fd, fname = tempfile.mkstemp(suffix=".step")
    os.close(fd)
    try:
        cq.exporters.export(solid, fname, exportType="STEP")  # type: ignore
        with open(fname, "rb") as f:
            return f.read()
    finally:
        try:
            os.unlink(fname)
        except OSError:
            pass


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


def _point_in_polygon(x, y, poly) -> bool:
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _safe_top_hole(poly, top_margin, r):
    """カスタム外形の上部に、穴を開けられる内部点を探す（フロントと同ロジック）。"""
    ys = [p[1] for p in poly]
    xs = [p[0] for p in poly]
    min_y, max_y = min(ys), max(ys)
    cx = sum(xs) / len(xs)
    span = max_y - min_y
    y = max_y - top_margin
    while y > min_y + r:
        if (
            _point_in_polygon(cx, y, poly)
            and _point_in_polygon(cx, y + r, poly)
            and _point_in_polygon(cx - r, y, poly)
            and _point_in_polygon(cx + r, y, poly)
            and _point_in_polygon(cx, y - r, poly)
        ):
            return (cx, y)
        y -= span * 0.02
    return None


def _pendant(p) -> "cq.Workplane":  # type: ignore
    shape = p.get("shape", "disc")
    w = p.get("width", 18)
    h = p.get("height", 18)
    t = p.get("thickness", 1.6)

    poly = None
    if shape == "custom" and p.get("outline") and len(p["outline"]) >= 3:
        # 画像トレース由来のカスタム外形（単位ボックス正規化）を width/height でスケール
        poly = [(pt["x"] * w, pt["y"] * h) for pt in p["outline"]]
        wp = cq.Workplane("XY").polyline(poly).close()
    elif shape in ("disc", "oval"):
        wp = cq.Workplane("XY").ellipse(w / 2, h / 2)
    else:
        wp = cq.Workplane("XY").rect(w, h)
    body = wp.extrude(t)

    bail = p.get("bail", {})
    if bail.get("type") == "integrated_hole":
        d = bail.get("innerDiameter", 3)
        wall = bail.get("wall", 1.5)
        r = d / 2
        if poly is not None:
            spot = _safe_top_hole(poly, wall + r, r)
            hole_xy = spot  # None なら穴を開けない
        else:
            hole_xy = (0, h / 2 - wall - r)
        if hole_xy is not None:
            hole = (
                cq.Workplane("XY")
                .moveTo(hole_xy[0], hole_xy[1])
                .circle(r)
                .extrude(t * 3)
                .translate((0, 0, -t))
            )
            body = body.cut(hole)
    return body
