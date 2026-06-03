'use client';

import { useEffect } from 'react';
import { useDesignStore } from '@/store/useDesignStore';

/**
 * キーボードショートカット（副作用専用・非表示）。
 *   ⌘/Ctrl+Z       元に戻す
 *   ⌘/Ctrl+Shift+Z やり直し（⌘/Ctrl+Y も可）
 * 入力中（input/textarea）は無効。
 */
export default function KeyboardShortcuts() {
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return null;
}
