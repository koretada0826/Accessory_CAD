# 💎 Atelier — AIネイティブ アクセサリーCAD

> **「アクセサリー作りを、誰でもできるように」**
> 画像・文章・直感的な操作だけで、アクセサリーの3D設計ができる。
> ノーコード感覚で触れて、数値も細かくいじれて、最終的に3Dプリント・原型制作・製造に繋げられる。

Atelier は、難しい従来CADではなく **Canva / Figma のような触りやすさ** を持ちながら、
アクセサリー設計に必要な本格機能（パラメトリック編集・製造チェック・各種3D出力）を備えた
「アクセサリー設計OS」です。

単なる3Dモデラーではなく、
**AIが画像や文章をアクセサリー構造に変換し、ユーザーがノーコードで編集できる** ことを核にしています。

---

## ✨ できること（現状の実装）

| 機能 | 状態 | 説明 |
|------|------|------|
| 🖼️ **画像→輪郭→3D化** | ✅ 段階2 | 画像から**実際の輪郭を抽出**し、編集可能なカスタム外形ペンダントに変換（背景除去→最大領域→Moore輪郭追跡→RDP間引き→平滑化→左右対称補正→吊り穴自動配置）。**ブラウザ内完結・API不要** |
| 🎨 ノーコードUX | ✅ | ウェルカム・ガイド / ✨おまかせ自動生成 / **かんたん⇄プロ**モード切替 / 自動保存 |
| 📄 技術仕様書 | ✅ | 寸法・素材・重量・原価・公差・製造警告・2D外形を1枚に → 印刷でPDF（工場提案用） |
| 🎛️ 数値の細かい編集 | ✅ | スライダー＋数値入力。内径/幅/厚み/角丸/石径… すべてmm単位 |
| 🖱️ 直感操作 | ✅ | 3Dをドラッグで回転・ズーム・パン。パーツをクリックで選択 |
| 🧩 複数カテゴリ | ✅ | リング/ペンダント/ピアス/ブレスレット を実装、他カテゴリもUI表示 |
| 🔭 3Dプレビュー | ✅ | リアルタイム。金属の反射、ワイヤーフレーム、寸法ガイド、ビュー切替 |
| 📤 エクスポート | ✅ | **STL / GLB / OBJ / SVG / JSON** はブラウザ単体で出力。STEP は backend 経由 |
| 🛡️ 製造チェック | ✅ | 最小肉厚/穴径/アーム強度… を検査し、推定重量・原価も表示 |
| 💬 AIチャット編集 | ✅ 段階1 | 「もう少し細く」「石を中央に」「13号にして」等を構造へ反映（ルールベース） |
| 🏷️ リング特化機能 | ✅ | 号数⇔内径変換、断面プロファイル(平打/甲丸/丸/ナイフ)、印台/石座トップ |

> 🔬 **AI部分（画像解析・チャット編集）は「段階1（ヒューリスティック/ルールベース）」です。**
> インターフェースは本番を見据えて設計してあり、後述のとおり LLM / セグメンテーションへ無改修で差し替えできます。

---

## 🏗️ アーキテクチャ

```
┌──────────────────────────── web (Next.js / React Three Fiber) ────────────────────────────┐
│  TopBar(保存 / Undo・Redo / Export / Import)                                              │
│ ┌─────────────┬───────────────────────────────┬──────────────────────┐                   │
│ │ Left        │ Center                         │ Right                │                   │
│ │ ・カテゴリ   │  3D Viewer（回転/ズーム/選択）  │ ・プロパティ編集      │                   │
│ │ ・画像UP     │ ──────────────────────────────│ ・素材/石/対称        │                   │
│ │ ・テンプレ   │  Manufacturing（製造チェック）  │ ・AIチャット          │                   │
│ └─────────────┴───────────────────────────────┴──────────────────────┘                   │
│                                                                                           │
│   ★ 唯一の真実のソース: AccessoryDesign（構造JSON） — Zustandが保持                        │
│        ├─ lib/geometry/      構造JSON → THREE.BufferGeometry（パラメトリック）             │
│        ├─ lib/manufacturing/ 構造JSON → 警告 / 重量 / 原価（純関数）                        │
│        ├─ lib/export/        GLB / STL / OBJ / SVG / JSON（クライアント）                  │
│        └─ lib/ai/            画像→構造JSON / 自然言語→パラメータ（差し替え可能）            │
└───────────────────────────────────────────────────────────────────────────────────────────┘
                         │ REST（任意・段階的に有効化）
┌─────────────────────── api (FastAPI / Python) ───────────────────────┐
│  /analyze-image  画像 → 構造JSON（将来: segmentation + 輪郭抽出）       │
│  /manufacturing/check  構造JSON → レポート                            │
│  /cad/generate   構造JSON → 厳密ソリッド（CadQuery, TODO: メッシュ返却）│
│  /export/step    構造JSON → STEP（CadQuery）                          │
└───────────────────────────────────────────────────────────────────────┘
```

**設計の肝**: `AI依存部` / `CADロジック` / `mesh表示` / `製造チェック` を完全分離し、
すべて中間表現 **`AccessoryDesign`（構造JSON）** だけを介して会話します。
これにより「画像をメッシュ化」ではなく **「編集可能なアクセサリー構造に変換」** が実現でき、
AIエンジンやCADエンジンを後から自由に強化できます。

> 💡 **重要:** フロントエンドは **backend なしでも全機能が動作** します（STEP出力を除く）。
> 画像解析もパラメトリック生成もエクスポートもブラウザ内で完結するので、まず `web` だけ動かせばOKです。

---

## 📁 ディレクトリ構成

```
ツール_アクセサリー/
├── README.md                ← このファイル
├── DESIGN.md                ← 設計思想・データモデル・ロードマップ詳細
│
├── web/                     ← フロントエンド（これだけで動く）
│   ├── app/                 Next.js App Router（layout / page / globals.css）
│   └── src/
│       ├── types/accessory.ts         ★ 構造JSONの型定義（プロダクトの心臓部）
│       ├── store/useDesignStore.ts    Zustand（状態・Undo/Redo・チャット）
│       ├── lib/
│       │   ├── data/        素材 / リングサイズ / テンプレ / ファクトリ
│       │   ├── geometry/    構造JSON → 3Dメッシュ（ring / pendant / simple）
│       │   ├── manufacturing/ 製造チェック（純関数ヒューリスティック）
│       │   ├── export/      STL / GLB / OBJ / SVG / JSON / STEP
│       │   └── ai/          画像解析 / チャット編集（差し替え可能なモック）
│       └── components/
│           ├── layout/      TopBar / LeftSidebar
│           ├── viewer/      Viewer（R3F）
│           ├── panels/      PropertyPanel / ManufacturingPanel / ChatPanel
│           └── ui/          スライダー等の共通コントロール
│
└── api/                     ← バックエンド（任意・段階的に使う）
    ├── requirements.txt
    └── app/
        ├── main.py          FastAPI エンドポイント
        ├── schema.py        Pydantic（構造JSON）
        ├── manufacturing.py 製造チェック（Python版）
        ├── vision.py        画像 → 構造JSON
        └── cad.py           STEP出力（CadQuery 任意）
```

---

## 🚀 セットアップ（初心者向け・手順どおりでOK）

### 必要なもの
- **Node.js 18 以上**（推奨: 20+） … フロントエンド用
- （任意）**Python 3.10 以上** … バックエンド用

### 1. フロントエンドを動かす（まずはこれだけでOK）

```bash
cd web
npm install        # 依存をインストール（初回のみ・数分）
npm run dev        # 開発サーバー起動
```

ブラウザで **http://localhost:3000** を開くと、すぐにアクセサリーCADが立ち上がります 🎉

> これだけで、画像アップロード・カテゴリ切替・3D編集・製造チェック・AIチャット・STL/GLB出力まで
> **すべて動きます**（backend不要）。

### 2.（任意）バックエンドを動かす

STEP出力や、将来の本格的な画像解析を使いたい場合のみ。

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

→ http://localhost:8000/docs で API を確認できます。

**STEP出力を有効にする場合**（OpenCascadeベースの厳密ソリッド）:
```bash
pip install cadquery            # やや重い。STEPが必要な時だけ
```

**フロントと接続する場合**:
```bash
cd web
cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE=http://localhost:8000
```

---

## 🎨 使い方ウォークスルー

1. **始め方を選ぶ**（左サイドバー）
   - **カテゴリ** … リング / ペンダント等を選んで空から作成
   - **画像** … 手持ちのアクセ画像をドロップ → AIがカテゴリ・寸法を推定
   - **テンプレ** … コインペンダント、甲丸バンド、一粒ストーンリング等のプリセット
2. **3Dビューで確認**（中央）… ドラッグで回転、上部ボタンで正面/側面/ワイヤー/寸法表示
3. **数値で詰める**（右パネル）… スライダー or 数値入力。リングは「号数」でも指定可能
4. **AIに頼む**（右下チャット）… 「もう少し細く」「石を中央に」「13号にして」「ゴシックに」
5. **製造性をチェック**（中央下）… 薄すぎ/穴小さすぎ等を警告、推定重量・原価も表示
6. **出力する**（右上エクスポート）… STL(3Dプリント) / GLB(Web・AR) / SVG(2D) / STEP(製造)

---

## 🧬 データモデル（構造JSON）

中核は `web/src/types/accessory.ts` の **`AccessoryDesign`**。カテゴリごとに `params` を
discriminated union で持ち、石/穴/刻印/装飾/対称/製造ルールはトップレベルで横断的に保持します。

```jsonc
{
  "category": "ring",
  "unit": "mm",
  "params": {                    // ← カテゴリ固有（kindで分岐）
    "kind": "ring",
    "innerDiameter": 17.0,       // 内径（号数と相互変換）
    "bandWidth": 3.0,
    "bandThickness": 1.6,
    "profile": "comfort",        // 平打/甲丸/丸/ナイフ
    "top": { "type": "stone", "width": 6, "length": 6, "height": 3 }
  },
  "components": [ /* shank, top, bezel ... */ ],
  "materialId": "platinum",
  "stones": [ /* cut, setting, diameter, position ... */ ],
  "holes": [], "patterns": [], "engraving": [],
  "symmetry": { "mirrorX": true, "mirrorY": false },
  "manufacturingRules": { "minWallThickness": 0.8, "minBandThickness": 1.0, ... },
  "warnings": []
}
```

詳細・他カテゴリの component 構成は **[DESIGN.md](./DESIGN.md)** を参照。

---

## 🧩 カテゴリの追加方法（拡張がしやすい設計）

新カテゴリ「○○」を足すには、原則この4点だけ:

1. `types/accessory.ts` … `Category` に追加し、必要なら `CategoryParams` に `○○Params` を追加
2. `lib/data/factory.ts` … `defaultParams` / `defaultComponents` / `CATEGORY_LABELS` にケース追加
3. `lib/geometry/` … `build○○` を実装し、`geometry/index.ts` の `switch` に1行追加
4. `components/panels/PropertyPanel.tsx` … `params.kind === '○○'` のブロックを追加

製造チェック・エクスポート・AIチャットは構造JSON経由なので、多くの場合 **無改修で機能します**。

---

## 🗺️ 実装ロードマップ

- **Step 1 ✅ 全体設計**（アーキテクチャ / データモデル / ディレクトリ）
- **Step 2 ✅ 全体像が見える初期コードベース**（全パネルUI + ダミー/ヒューリスティック実装）
- **Step 3 🚧 本物に近づける**
  - [x] Ring パラメトリック生成（号数・プロファイル・トップ・石）
  - [x] Pendant パラメトリック生成（外形・吊り穴・バチカン・石）
  - [x] 数値編集の即時3D反映・製造チェック・重量推定
  - [x] STL/GLB/OBJ/SVG 出力
  - [x] 画像→**輪郭抽出**→3D化（ブラウザ内: 背景除去/Moore追跡/RDP/対称補正/吊り穴自動配置）
  - [x] 左右対称補正（極座標シンメトライズ）
  - [ ] 石/バチカン/穴の**部品認識**（backend: OpenCV/segmentation でさらに高精度化）
  - [ ] CadQuery による STEP の本実装・厳密メッシュ返却
  - [ ] チャット編集の **LLM(function-calling)** 化
- **Step 4 ✅ READMEを丁寧に**（このファイル + DESIGN.md）

将来: ブランド/ショップ向けカスタムオーダー基盤、共有URL、価格見積、量産CAM連携。

---

## 🔧 トラブルシューティング

| 症状 | 対処 |
|------|------|
| `npm run dev` でエラー | Node 18+ を確認。`web/` 内で `rm -rf node_modules && npm install` |
| 3Dが真っ黒 | WebGL対応ブラウザ（Chrome/Edge/Safari最新）で開く。GPUアクセラレーション有効化 |
| STEP出力が失敗 | backend起動 + `pip install cadquery` + `.env.local` の `NEXT_PUBLIC_API_BASE` 設定 |
| 画像解析が雑 | 現状は段階1（簡易ヒューリスティック）。backend強化で改善予定 |

---

## 📜 ライセンス / クレジット
- 個人開発の試作プロジェクト。3D: three.js / React Three Fiber、UI: Next.js / Tailwind CSS。
- 設計思想・データモデルは [DESIGN.md](./DESIGN.md) に詳述。
