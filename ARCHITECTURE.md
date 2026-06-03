# Atelier アーキテクチャ — 仕組みの全体図

> このドキュメントは「中で何が起きているか」を、特に **Atelier と CadQuery の関係** を中心に図解する。
> 設計思想は [DESIGN.md](./DESIGN.md)、使い方は [README.md](./README.md) を参照。

---

## 0. ひとことで

> **CadQuery = コードで厳密ソリッドを作る“部品工場”。**
> **Atelier = ユーザーの直感操作を中間表現（構造JSON）に翻訳し、そこから CadQuery のコードを自動生成して工場を動かす“無人の通訳＆オペレーター”。**

ユーザーは CadQuery の存在を知らなくていい。STEPボタンを押すと、裏で Atelier が CadQuery を動かしているだけ。

---

## 1. 唯一の真実のソース：構造JSON `AccessoryDesign`

すべてのモジュールはこの中間表現だけを介して会話する（疎結合）。
画像・文章・スライダー・テンプレ・おまかせ —— どの入口も最終的にこの1つの型を作る。

```
入力（画像 / 文章 / スライダー / テンプレ / おまかせ）
      │
      ▼
 ┌──────────────────────────────────────────────┐
 │  ★ AccessoryDesign（構造JSON）= 心臓           │
 │   category / params(kind別) / components /     │
 │   stones / holes / engraving / patterns /      │
 │   symmetry / materialId / manufacturingRules   │
 └───────────────┬───────────────────┬───────────┘
                 │                   │
   【表示・編集系：ブラウザ】       【厳密出力系：バックエンド】
```

中間表現を挟むことで、AI を強化しても CAD は無関係に進化でき、その逆も成り立つ。

---

## 2. 二系統エンジン：なぜ2つ使い分けるのか

同じ `AccessoryDesign` から、**軽い近似メッシュ（表示用）** と **厳密ソリッド（製造用）** の2系統を作る。

| | ブラウザ Three.js | バックエンド CadQuery / OpenCascade |
|---|---|---|
| 速さ・対話性 | ◎ リアルタイム | △ サーバー処理 |
| 精度 | 近似メッシュ（プレビュー・3Dプリント向け） | **厳密B-rep（鋳造原型・STEPの正確さ）** |
| 動く場所 | ブラウザ（Python不可） | サーバー（Python） |
| 使う場面 | 常時の編集・プレビュー・STL/GLB/OBJ/PNG | STEP出力の時だけ |

```
        AccessoryDesign（構造JSON）
         │                       │
   lib/geometry/*.ts        FastAPI → app/cad.py
   構造JSON→THREE.Mesh       構造JSON→CadQueryコードを“自動生成”→実行
   （近似・軽量）             OpenCascadeで厳密ソリッド
         │                       │
   R3Fで3D表示              STEP（ISO-10303-21）
   STL/GLB/OBJ/PNG/SVG       （工場・原型師が欲しい正確データ）
```

### “CadQueryコードを自動生成”の実例

ユーザーがバンド厚スライダーを動かす → `bandThickness` が変わる → `app/cad.py` がそれを読んで、こういう CadQuery を**自動で組み立てて実行**する（抜粋・実物）：

```python
# 構造JSON {kind:ring, innerDiameter:17, bandThickness:1.6, bandWidth:3} から
band = cq.Workplane("XY").circle(outer_r).circle(inner_r).extrude(width)
```

画像トレースの星形でも同じ理屈：

```python
# 正規化outlineをwidth/heightでスケール → 押し出し → STEP
cq.Workplane("XY").polyline(points).close().extrude(thickness)
```

---

## 3. 画像 → 構造化パイプライン（看板機能）

「画像をメッシュ化」ではなく「**編集可能な構造に変換**」する。すべてブラウザ内で完結（API不要・課金ゼロ）。

```
画像 dataURL
  │  lib/ai/imageContour.ts
  ├─ 1. 縮小(最長220px) → canvas
  ├─ 2. 背景除去（透過PNGはalpha / 写真は四隅背景色との差）→ 前景マスク
  ├─ 2.5 モルフォロジー open→close（ノイズ低減・縁の平滑化）
  ├─ 3. 最大連結成分（主要被写体の抽出）
  ├─ 4. Moore近傍追跡（外周輪郭）
  ├─ 5. RDP間引き → 等間隔リサンプル → 平滑化
  ├─ 6. 正規化（単位ボックス）+ mm寸法推定 + 左右対称化
  ├─ 7. 内部穴検出（補集合を境界からflood fill→囲まれた背景=穴）
  └─ 8. 石検出（前景の金属色から色差大・高彩度の領域→平均色/位置/径）
  │
  ▼  lib/ai/analyzeImage.ts
AccessoryDesign（shape=custom, outline, holes, stones, 対称, 素材推定）
  │
  ▼
編集可能な3Dペンダント（幅/高さ/厚み/石/穴/刻印は以降も編集できる）
```

ポイント：outline は **正規化頂点列** として保持。だからトレース後も幅/高さスライダーで編集を継続できる。

---

## 4. 製造可能性 & 原価（工場提案レベル）

`lib/manufacturing/` は構造JSONだけを見る純関数群。

```
AccessoryDesign
  ├─ check.ts          肉厚/穴径/アーム/接続部の警告 + 全体集約
  ├─ meshHealth.ts     生成メッシュの位相を解析し manifold(水密) を実測判定
  ├─ cost.ts           地金+石+鋳造/仕上げ工賃 → 製造原価合計 + 小売概算レンジ
  │                    + 鋳造メモ（収縮/肉盗み/湯口/研磨代）
  └─ → ManufacturingReport（警告/重量/原価/水密/印刷適性）
                          │
                          ├─ ManufacturingPanel（画面下）
                          └─ specSheet.ts → 技術仕様書HTML（印刷でPDF・工場提案）
```

---

## 5. ディレクトリ × 役割

```
web/src/
├── types/accessory.ts            ★ 構造JSON（AccessoryDesign）の型定義
├── store/useDesignStore.ts       Zustand：状態 / Undo・Redo / チャット / モード / おまかせ
├── lib/
│   ├── data/                     素材 / リングサイズ(号⇔内径) / テンプレ / ファクトリ / ランダム
│   ├── geometry/                 構造JSON → THREE.Mesh（ring / pendant / simple / primitives）
│   ├── manufacturing/            check / meshHealth / cost（純関数）
│   ├── export/                   exporters(STL/GLB/OBJ/SVG/JSON/PNG/STEP) / specSheet
│   └── ai/                       imageContour / analyzeImage / chatEdit（差し替え可能）
└── components/
    ├── layout/                   TopBar / LeftSidebar
    ├── viewer/                   Viewer(R3F) / EngravingDecal
    ├── panels/                   PropertyPanel / ManufacturingPanel / ChatPanel
    ├── ui/                       共通コントロール
    ├── ErrorBoundary / WelcomeOverlay / KeyboardShortcuts / PersistenceBridge

api/app/
├── main.py        FastAPI エンドポイント
├── schema.py      Pydantic（構造JSON・extra=allowで拡張に強い）
├── manufacturing.py  製造チェック（Python版）
├── vision.py      画像→構造JSON（将来のseg/OpenCV強化用）
└── cad.py         構造JSON→CadQuery→STEP（Ring/Pendant/custom outline）
```

---

## 6. 1アクションの流れ（例：スライダーで厚みを変える）

```
① ユーザーがスライダー操作
② PropertyPanel → store.commit(draft => draft.params.thickness = v)
③ store：履歴push + runManufacturingCheck 再計算（警告/重量/原価/水密）
④ Viewer：buildModel(design) で近似メッシュ再生成 → R3Fが再描画
⑤ PersistenceBridge：localStorageへ自動保存（デバウンス）
   （STEPボタンを押した時だけ ⑥ api/cad.py が CadQueryで厳密STEPを生成）
```

派生（メッシュ・警告・原価・STEP）はすべて純関数。状態は構造JSON1つに集約。

---

## 7. 差し替え方針（疎結合の旨味）

- `lib/ai/imageContour・analyzeImage` … ブラウザ・ヒューリスティック → backend(OpenCV/segmentation/部品認識) へ。戻り値 `AccessoryDesign` を固定すれば UI 無改修。
- `lib/ai/chatEdit` … ルールベース → LLM(function-calling) へ。出力 `ChatEditResult` を固定。
- `app/cad.py` … 近似や別カーネル → OpenCascade厳密、CAM連携へ。契約は構造JSON。

「構造JSONという契約」を守る限り、各レイヤーは独立に進化できる。これが Atelier の拡張性の核。
