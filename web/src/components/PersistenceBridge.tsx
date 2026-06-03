'use client';

import { useEffect, useRef } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import type { AccessoryDesign } from '@/types/accessory';
import { SCHEMA_VERSION } from '@/types/accessory';

const KEY = 'atelier:design:v1';

/**
 * 構造JSONをlocalStorageに自動保存・復元する（API課金なし・ブラウザ内完結）。
 * - マウント時: 直近のデザインを復元
 * - 変更時: デバウンスして保存
 * UIは描画しない（副作用専用コンポーネント）。
 */
export default function PersistenceBridge() {
  const importDesign = useDesignStore((s) => s.importDesign);
  const restored = useRef(false);

  // 復元（初回のみ）
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as AccessoryDesign;
      if (d && d.schemaVersion === SCHEMA_VERSION && d.params && d.category) {
        importDesign(d);
      }
    } catch {
      /* 壊れたデータは無視 */
    }
  }, [importDesign]);

  // 保存（design変更をデバウンス）
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const unsub = useDesignStore.subscribe((state) => {
      if (t) clearTimeout(t);
      const design = state.design;
      t = setTimeout(() => {
        try {
          localStorage.setItem(KEY, JSON.stringify(design));
        } catch {
          /* 容量超過等は無視 */
        }
      }, 400);
    });
    return () => {
      if (t) clearTimeout(t);
      unsub();
    };
  }, []);

  return null;
}
