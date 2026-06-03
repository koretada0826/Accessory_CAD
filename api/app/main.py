"""
Atelier API — AIアクセサリーCAD バックエンド（段階実装）

役割分担（フロントと疎結合・構造JSONだけで会話）:
  - /analyze-image   画像 → 構造JSON（段階1: ヒューリスティック / 将来: seg+輪郭）
  - /manufacturing/check  構造JSON → 製造レポート（重量/原価/警告）
  - /cad/generate    構造JSON → 厳密ソリッド生成の足場（TODO: メッシュ返却）
  - /export/step     構造JSON → STEP（CadQuery 必須）

起動:
  pip install -r requirements.txt
  uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .schema import AccessoryDesign, AnalyzeResult, ManufacturingReport
from .manufacturing import run_check
from .vision import analyze_image
from .cad import build_step, CadQueryUnavailable, HAS_CADQUERY

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("atelier")

app = FastAPI(title="Atelier API", version="0.1.0", description="AI Accessory CAD backend")

# 開発用CORS（本番は許可ドメインを絞る）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "cadquery": HAS_CADQUERY}


@app.post("/analyze-image", response_model=AnalyzeResult)
async def analyze(image: UploadFile = File(...)):
    """画像をアップロード → 構造JSON を推定して返す。"""
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="空のファイルです")
    try:
        result = analyze_image(data)
        log.info("analyze-image: %s (conf=%.2f)", result.detected.estimatedCategory, result.confidence)
        return result
    except Exception as e:  # noqa: BLE001
        log.exception("analyze-image failed")
        raise HTTPException(status_code=422, detail=f"画像解析に失敗: {e}")


@app.post("/manufacturing/check", response_model=ManufacturingReport)
def manufacturing_check(design: AccessoryDesign):
    """構造JSON → 製造可能性レポート。"""
    return run_check(design)


@app.post("/cad/generate")
def cad_generate(design: AccessoryDesign):
    """
    構造JSON → 厳密ソリッド生成の足場。
    TODO: CadQuery でソリッド生成し、tessellate して GLB/メッシュを返す。
    現状は受理確認とメタ情報のみ返す。
    """
    log.info("cad/generate: category=%s kind=%s", design.category, design.params.get("kind"))
    return {
        "accepted": True,
        "category": design.category,
        "engine": "cadquery" if HAS_CADQUERY else "none",
        "todo": "ソリッド生成→tessellate→GLB返却を実装予定",
    }


@app.post("/export/step")
def export_step(design: AccessoryDesign):
    """構造JSON → STEP ファイル。CadQuery が必要。"""
    try:
        data = build_step(design)
    except CadQueryUnavailable as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:  # noqa: BLE001
        log.exception("step export failed")
        raise HTTPException(status_code=500, detail=f"STEP生成に失敗: {e}")

    filename = (design.name or "accessory") + ".step"
    return Response(
        content=data,
        media_type="application/step",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
