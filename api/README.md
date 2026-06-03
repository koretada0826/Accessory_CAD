# Atelier API (backend)

フロントエンドの構造JSON（`AccessoryDesign`）をそのまま受け取る、疎結合な FastAPI バックエンド。
**フロントは backend なしでも全機能動作します**（STEP出力を除く）。このAPIは段階的に有効化してください。

## 起動

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

→ http://localhost:8000/docs（Swagger UI）

## エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | `/health` | 稼働確認（CadQueryの有無も返す） |
| POST | `/analyze-image` | 画像(multipart) → 構造JSON推定（`AnalyzeResult`） |
| POST | `/manufacturing/check` | 構造JSON → 製造レポート（重量/原価/警告） |
| POST | `/cad/generate` | 構造JSON受理（TODO: ソリッド→メッシュ返却） |
| POST | `/export/step` | 構造JSON → STEP（**CadQuery必須**） |

## 任意の追加依存

```bash
pip install cadquery                                  # STEP出力 / 厳密ソリッド
pip install opencv-python-headless trimesh shapely scipy   # 輪郭抽出 / メッシュ処理
```

## 構成

```
app/
├── main.py          FastAPI エンドポイント（CORS有効・ログ出力）
├── schema.py        Pydantic（構造JSON, extra=allow でカテゴリ拡張に強い）
├── manufacturing.py 製造チェック・体積/重量推定（フロントと同等ロジックのPython版）
├── vision.py        画像 → 構造JSON（段階1: Pillow/numpyヒューリスティック）
└── cad.py           STEP生成（CadQuery任意 / Ring・Pendant対応）
```

## 進化の方針
- `vision.py` … segmentation + 輪郭抽出 + 部品認識へ差し替え（戻り値`AnalyzeResult`は固定）。
- `cad.py` … 近似ではなくOCCで厳密生成、`/cad/generate` でtessellate→GLB返却。
- いずれも構造JSON契約を維持するため、フロントは無改修で恩恵を受けられる。
