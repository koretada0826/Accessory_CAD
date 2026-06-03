# Atelier 設計ドキュメント

このドキュメントは、Atelier（AIアクセサリーCAD）の **設計思想・データフロー・データモデル・
コンポーネント設計・拡張方針** を記述します。実装の「なぜ」を残すための文書です。

---

## 1. 設計原則

1. **唯一の真実のソースは構造JSON（`AccessoryDesign`）**
   3D・製造チェック・エクスポート・AIは、すべてこの中間表現だけを介して会話する。
2. **「メッシュ化」ではなく「構造化」**
   画像はポリゴンに潰さない。編集可能なパラメータ（内径・厚み・石位置…）へ変換する。
3. **AI / CAD / 表示 / 製造 の分離**
   各モジュールは差し替え可能。AIをヒューリスティック→LLMへ、CADを近似メッシュ→OCCへ、
   個別に進化させられる。
4. **段階実装だが、構造は本番設計**
   モックでも公開インターフェースは本番形。後で中身だけ差し替える。
5. **ノーコード感 × 数値の厳密性の両立**
   スライダーで触れて、同じ値を数値入力でも編集できる。プロにも初心者にも。

---

## 2. データフロー

```
                ┌─────────── 入力 ───────────┐
   画像 ─┐      テキスト ─┐    テンプレ ─┐   空 ─┐
         ▼               ▼              ▼       ▼
   analyzeImage()   applyChatEdit()   build()  createDesign()
         └───────────────┴──────┬───────┴───────┘
                                ▼
                   ★ AccessoryDesign（構造JSON）
                                │  (Zustand: commit/undo/redo)
        ┌───────────────┬───────┼────────────────┬─────────────────┐
        ▼               ▼       ▼                ▼                 ▼
   buildModel()   runManufacturingCheck()   exporters       PropertyPanel
   (geometry)      (warnings/weight/cost)  (STL/GLB/...)    (双方向編集)
        ▼               ▼                       ▼
   R3F <mesh>     ManufacturingPanel       ダウンロード
```

- **入力の正規化**: どの入力経路も最終的に `AccessoryDesign` を生成する。以降の処理は入力経路を問わない。
- **派生は純関数**: メッシュ・警告・体積は `AccessoryDesign` からの純関数。状態に副作用を持たせない。
- **編集は中央集約**: すべての変更は `store.commit(draft => ...)` を通り、履歴と製造レポート再計算が自動で走る。

---

## 3. データモデル詳細（カテゴリ別 component 構成）

`AccessoryDesign.params` は `kind` による discriminated union。`components[]` は論理パーツ
（選択・可視・ハイライトの単位）。

### Pendant (`kind: "pendant"`)
- params: `shape`(disc/oval/tag/heart/shield/hexagon), `width/height/thickness/cornerRadius`, `bail{type,innerDiameter,wall}`
- components: `body` / `bail` / `border`（＋ `cutout` は holes で表現）
- 生成: 外形Shapeを押し出し、吊り穴/装飾穴は `Shape.holes` で打ち抜き。丸カン/チューブはトーラス追加。

### Ring (`kind: "ring"`)
- params: `innerDiameter`(号数連動), `bandWidth/bandThickness`, `profile`(flat/comfort/round/knife), `top{type,width,length,height}`
- components: `shank` / `top` / `bezel`（＋ `prongs` / `gallery` は将来）
- 生成: 断面プロファイルを内径周りに掃引。印台/ドーム/石座+石をトップに合成。
- 特化: `data/ringSize.ts` で号数⇔内径（内周=号+39 近似）。シグネット/ストーンへ拡張容易。

### Earrings (`kind: "earrings"`)
- params: `style`(stud/hook/hoop/drop), `bodyWidth/bodyHeight/thickness`, `hoopDiameter`, `wireDiameter`
- components: `stud`/`hook`/`connector`（hoop時は `hoop`）
- 生成: 本体プレート + ポスト/フック曲線（TubeGeometry）or フープ（トーラス）。

### Bracelet (`kind: "bracelet"`)
- params: `style`(plate/link/bangle), `plateWidth/plateLength/thickness`, `linkCount`, `innerCircumference`
- components: `plate`/`link`/`clasp`
- 生成: 中央プレート + リンクを弧状配置（簡易）。bangleはトーラス弧。

### 横断要素（全カテゴリ共通）
- `stones[]`（cut/setting/diameter/position/height/color）
- `holes[]`（role: bail/decoration/functional）
- `patterns[]`（hammered/brushed/lines/dots/gothic）→ 表面roughnessへ反映
- `engraving[]`（text/size/depth/position/font）
- `symmetry`（mirrorX/Y）, `manufacturingRules`, `warnings[]`

---

## 4. モジュール設計（責務）

| モジュール | 責務 | 入力 → 出力 | 進化方針 |
|-----------|------|-------------|---------|
| `lib/ai/analyzeImage` | 画像→構造化 | dataURL → AnalyzeResult | seg/輪郭/部品認識（backend） |
| `lib/ai/chatEdit` | 言語→パラメータ | text+design → 変更後design | LLM function-calling |
| `lib/geometry/*` | パラメトリック生成 | design → BuiltModel(mesh) | OCC厳密ソリッド（backend） |
| `lib/manufacturing/check` | 製造性・重量 | design → report | 素材別ルール/FEM |
| `lib/export/*` | 各種出力 | design → file | STEP本実装/CAM |
| `store/useDesignStore` | 状態・履歴・チャット | actions | 永続化(Supabase) |

> mesh表示(`BuiltModel`)とCADデータ(`AccessoryDesign`)は **意図的に別型**。
> 表示は近似でよく、製造は厳密、という非対称を吸収するため。

---

## 5. UI設計

- 4ペイン: 左(アセット) / 中央(3D + 製造) / 右(プロパティ + チャット)。
- ダークテーマ + ゴールド系アクセントでジュエリーの高級感。
- ノーコード感: スライダー・トグル・セグメント・色ピッカー中心。
- 数値の厳密性: 各スライダーに数値入力を併設。リングは号数入力も。
- パーツ選択で右パネル/3Dハイライトが連動（選択 → 編集対象の明確化）。

---

## 6. 既知の割り切り（段階1）

- 画像解析はアスペクト比/明度のみ（輪郭・部品・石は未認識）。
- ブラウザ生成メッシュは近似（CSGは `Shape.holes` のみ。爪/彫りは簡易表現）。
- チャット編集は日本語キーワードのルールベース。
- STEPはCadQuery導入時のみ。`cad/generate` のメッシュ返却は未実装(TODO)。

これらは公開インターフェース（`AnalyzeResult` / `ChatEditResult` / `BuiltModel` / `ManufacturingReport`）
を固定したまま、内部実装を差し替えて解消していく。

---

## 7. 将来の拡張（商用SaaS化）

- プロジェクト永続化・共有URL・バージョン履歴（Supabase/S3）。
- ブランド/ショップ向けカスタムオーダー基盤（テンプレ配布・パラメータ制限・価格見積）。
- 量産連携（鋳造用湯道、レーザー刻印データ、CAMエクスポート）。
- 本格AI（Vision LLMで画像→構造JSON、自然言語→JSON Patch、製造補正提案）。
