/**
 * ============================================================================
 *  AccessoryDesign — アクセサリー構造JSON（中間表現 / 唯一の真実のソース）
 * ============================================================================
 *
 *  このプロダクトの心臓部。AI解析・CAD生成・mesh表示・製造チェック・エクスポート、
 *  すべてのモジュールはこの型だけを介して会話する（= 疎結合）。
 *
 *  設計方針:
 *    - 「メッシュ」ではなく「編集可能なパラメータ」として保持する
 *    - カテゴリごとに `params`（discriminated union）で固有パラメータを表現する
 *    - 共通要素（石/穴/刻印/装飾/対称/製造ルール）はトップレベルで横断的に持つ
 *    - 新カテゴリは CategoryParams にケースを足すだけで拡張できる
 */

// ---------------------------------------------------------------------------
// 基本
// ---------------------------------------------------------------------------

export type Unit = 'mm';

/** 対応カテゴリ（UIには全カテゴリ出すが、paramsの実体は段階実装） */
export type Category =
  | 'pendant'
  | 'ring'
  | 'earrings'
  | 'earcuff'
  | 'bracelet'
  | 'necklace'
  | 'charm'
  | 'dogtag'
  | 'signet'
  | 'band'
  | 'stone_ring'
  | 'hoop';

/** 実装優先度の高い「フル機能」カテゴリ */
export const FULLY_IMPLEMENTED: Category[] = ['pendant', 'ring'];

// ---------------------------------------------------------------------------
// 素材
// ---------------------------------------------------------------------------

export type MaterialId =
  | 'gold_yellow'
  | 'gold_white'
  | 'gold_rose'
  | 'silver'
  | 'platinum'
  | 'brass'
  | 'steel'
  | 'resin';

export interface Material {
  id: MaterialId;
  label: string;
  /** 見た目（PBR） */
  color: string;
  metalness: number;
  roughness: number;
  /** 密度 g/cm^3 — 推定重量・原価に使用 */
  density: number;
  /** 1gあたりの参考原価（円）。将来 backend で実勢に差し替え */
  costPerGram: number;
}

// ---------------------------------------------------------------------------
// 横断要素（どのカテゴリでも使える共通パーツ）
// ---------------------------------------------------------------------------

export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };

export type StoneCut = 'round' | 'oval' | 'princess' | 'pear' | 'marquise' | 'cabochon';
export type StoneSetting = 'bezel' | 'prong' | 'flush' | 'pave' | 'none';

export interface Stone {
  id: string;
  cut: StoneCut;
  setting: StoneSetting;
  /** 石径（round/princess）または長径 mm */
  diameter: number;
  /** 着座位置（コンポーネント面上の正規化〜実寸座標 mm） */
  position: Vec2;
  /** 0=表面 / +で突出 */
  height: number;
  color: string;
}

export interface Hole {
  id: string;
  /** 穴の用途。bail=吊り穴 / decoration=装飾 / functional=機能穴 */
  role: 'bail' | 'decoration' | 'functional';
  diameter: number;
  position: Vec2;
}

export type PatternType = 'none' | 'hammered' | 'brushed' | 'lines' | 'dots' | 'gothic';

export interface Pattern {
  id: string;
  type: PatternType;
  /** 0..1 強さ */
  intensity: number;
}

export interface Engraving {
  id: string;
  text: string;
  /** mm（文字高さ） */
  size: number;
  /** +凸 / -凹 */
  depth: number;
  position: Vec2;
  font: 'serif' | 'sans' | 'script';
}

export interface SymmetrySettings {
  /** 左右対称を強制 */
  mirrorX: boolean;
  /** 上下対称 */
  mirrorY: boolean;
}

/** 製造ルール（しきい値）。素材や用途で変わる */
export interface ManufacturingRules {
  /** 最小肉厚 mm */
  minWallThickness: number;
  /** 最小穴径 mm */
  minHoleDiameter: number;
  /** リングアーム最小厚 mm */
  minBandThickness: number;
  /** 接続部最小幅 mm（ピアス/ブレス連結） */
  minConnectorWidth: number;
}

export type WarningSeverity = 'error' | 'warning' | 'info';

export interface Warning {
  id: string;
  severity: WarningSeverity;
  /** 関連コンポーネント/パラメータ（ハイライト用） */
  target?: string;
  title: string;
  detail: string;
  /** 修正候補（AI/ワンクリック補正で使用） */
  suggestion?: string;
}

// ---------------------------------------------------------------------------
// コンポーネント（パーツ）— カテゴリ横断の論理パーツ
// ---------------------------------------------------------------------------

export type ComponentType =
  // pendant
  | 'body'
  | 'bail'
  | 'border'
  | 'cutout'
  // ring
  | 'shank'
  | 'top'
  | 'bezel'
  | 'prongs'
  | 'gallery'
  // earrings
  | 'hook'
  | 'stud'
  | 'hoop'
  | 'drop'
  | 'connector'
  // bracelet
  | 'plate'
  | 'link'
  | 'clasp';

export interface Component {
  id: string;
  type: ComponentType;
  label: string;
  visible: boolean;
  /** 任意の追加パラメータ（型は params 側で保証、ここは表示メタ） */
  note?: string;
}

// ---------------------------------------------------------------------------
// カテゴリ固有パラメータ（discriminated union）
// ---------------------------------------------------------------------------

export type RingProfile = 'flat' | 'round' | 'comfort' | 'knife';
export type RingTopType = 'none' | 'signet' | 'stone' | 'dome';

export interface RingParams {
  kind: 'ring';
  /** 内径 mm（リングサイズと相互変換） */
  innerDiameter: number;
  bandWidth: number;
  bandThickness: number;
  profile: RingProfile;
  top: {
    type: RingTopType;
    width: number;
    length: number;
    height: number;
  };
}

export type PendantShape = 'disc' | 'rect' | 'heart' | 'shield' | 'oval' | 'hexagon' | 'tag' | 'custom';
export type BailType = 'integrated_hole' | 'ring_bail' | 'tube' | 'none';

export interface PendantParams {
  kind: 'pendant';
  shape: PendantShape;
  width: number;
  height: number;
  thickness: number;
  cornerRadius: number;
  bail: {
    type: BailType;
    /** 吊り穴/バチカン内径 */
    innerDiameter: number;
    wall: number;
  };
  /**
   * 画像トレース由来のカスタム外形。単位ボックス[-0.5,0.5]に正規化した頂点列。
   * shape==='custom' のとき buildShape が width/height でスケールして使用する。
   * 正規化保持なので、トレース後も幅/高さスライダーで編集を継続できる。
   */
  outline?: Vec2[];
  /**
   * 画像由来の立体レリーフ（バスレリーフ）。画像の陰影から作った高さマップを
   * 前面に隆起させ、平板トレースを立体化する。gx×gy のグリッド（行優先）。
   * data は 0..1 の正規化高さ（外形マスク外は -1）。depth は最大隆起 mm。
   */
  relief?: {
    gx: number;
    gy: number;
    data: number[];
    depth: number;
  };
}

export interface EarringsParams {
  kind: 'earrings';
  style: 'stud' | 'hook' | 'hoop' | 'drop';
  bodyWidth: number;
  bodyHeight: number;
  thickness: number;
  /** hoop時の直径 */
  hoopDiameter: number;
  wireDiameter: number;
}

export interface BraceletParams {
  kind: 'bracelet';
  style: 'plate' | 'link' | 'bangle';
  plateWidth: number;
  plateLength: number;
  thickness: number;
  /** リンク数 */
  linkCount: number;
  innerCircumference: number;
}

/** まだ専用UIを持たないカテゴリの汎用フォールバック */
export interface GenericParams {
  kind: 'generic';
  width: number;
  height: number;
  thickness: number;
}

export type CategoryParams =
  | RingParams
  | PendantParams
  | EarringsParams
  | BraceletParams
  | GenericParams;

// ---------------------------------------------------------------------------
// プロジェクト
// ---------------------------------------------------------------------------

export interface ProjectMeta {
  createdAt: string;
  updatedAt: string;
  /** 由来: image=画像解析 / template / scratch / ai */
  origin: 'image' | 'template' | 'scratch' | 'ai';
  /** 解析元画像（dataURL, 任意） */
  sourceImage?: string;
  notes?: string;
}

export interface AccessoryDesign {
  id: string;
  name: string;
  category: Category;
  unit: Unit;
  meta: ProjectMeta;

  /** カテゴリ固有パラメータ（最重要） */
  params: CategoryParams;

  /** 論理パーツ一覧（選択/可視/ハイライト用） */
  components: Component[];

  /** 横断要素 */
  materialId: MaterialId;
  stones: Stone[];
  holes: Hole[];
  patterns: Pattern[];
  engraving: Engraving[];
  symmetry: SymmetrySettings;

  manufacturingRules: ManufacturingRules;
  /** 製造チェック結果（派生だが永続化対象） */
  warnings: Warning[];

  /** スキーマバージョン（マイグレーション用） */
  schemaVersion: number;
}

export const SCHEMA_VERSION = 1;
