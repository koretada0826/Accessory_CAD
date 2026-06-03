import type { Material, MaterialId } from '@/types/accessory';

/** 素材マスタ。density(g/cm^3) と costPerGram(円) は参考値。将来 backend で実勢更新 */
export const MATERIALS: Record<MaterialId, Material> = {
  gold_yellow: {
    id: 'gold_yellow',
    label: 'イエローゴールド (K18)',
    color: '#e7bb52', // 18K polished yellow gold（やや深く上質に）
    metalness: 1,
    roughness: 0.19,
    density: 15.6,
    costPerGram: 9000,
  },
  gold_white: {
    id: 'gold_white',
    label: 'ホワイトゴールド (K18)',
    color: '#e9e9ee',
    metalness: 1,
    roughness: 0.18,
    density: 15.7,
    costPerGram: 9200,
  },
  gold_rose: {
    id: 'gold_rose',
    label: 'ローズゴールド (K18)',
    color: '#e7b08a',
    metalness: 1,
    roughness: 0.22,
    density: 15.2,
    costPerGram: 9000,
  },
  silver: {
    id: 'silver',
    label: 'シルバー (SV925)',
    color: '#d8dade',
    metalness: 1,
    roughness: 0.2,
    density: 10.4,
    costPerGram: 120,
  },
  platinum: {
    id: 'platinum',
    label: 'プラチナ (Pt950)',
    color: '#dadde0',
    metalness: 1,
    roughness: 0.16,
    density: 21.4,
    costPerGram: 4800,
  },
  brass: {
    id: 'brass',
    label: '真鍮 (Brass)',
    color: '#c79a4b',
    metalness: 1,
    roughness: 0.32,
    density: 8.5,
    costPerGram: 5,
  },
  steel: {
    id: 'steel',
    label: 'ステンレス',
    color: '#b8bcc2',
    metalness: 1,
    roughness: 0.35,
    density: 7.9,
    costPerGram: 3,
  },
  resin: {
    id: 'resin',
    label: '樹脂 (原型/試作)',
    color: '#cfd3da',
    metalness: 0.0,
    roughness: 0.6,
    density: 1.2,
    costPerGram: 2,
  },
};

export const MATERIAL_LIST = Object.values(MATERIALS);
