'use client';

import dynamic from 'next/dynamic';
import TopBar from '@/components/layout/TopBar';
import LeftSidebar from '@/components/layout/LeftSidebar';
import PropertyPanel from '@/components/panels/PropertyPanel';
import ManufacturingPanel from '@/components/panels/ManufacturingPanel';
import ChatPanel from '@/components/panels/ChatPanel';
import PersistenceBridge from '@/components/PersistenceBridge';
import WelcomeOverlay from '@/components/WelcomeOverlay';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useDesignStore } from '@/store/useDesignStore';

// 3DビューアはSSR不可（WebGL/window依存）のため client-only で読み込む
const Viewer = dynamic(() => import('@/components/viewer/Viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-ink-500">3Dビューアを準備中…</div>
  ),
});

export default function Page() {
  const newProject = useDesignStore((s) => s.newProject);
  const safeReset = () => newProject('ring');

  return (
    <div className="flex h-screen flex-col bg-ink-950">
      <PersistenceBridge />
      <KeyboardShortcuts />
      <WelcomeOverlay />
      <TopBar />

      <div className="flex min-h-0 flex-1">
        {/* 左: アセット / カテゴリ / 画像 / テンプレ */}
        <aside className="hairline-r glass w-52 shrink-0 lg:w-64">
          <ErrorBoundary label="左パネル" onReset={safeReset}>
            <LeftSidebar />
          </ErrorBoundary>
        </aside>

        {/* 中央: 3Dビューア（主役） + 製造チェック */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <ErrorBoundary label="3Dビュー" onReset={safeReset}>
              <Viewer />
            </ErrorBoundary>
          </div>
          <div className="hairline-t glass shrink-0">
            <ErrorBoundary label="製造チェック" onReset={safeReset}>
              <ManufacturingPanel />
            </ErrorBoundary>
          </div>
        </main>

        {/* 右: プロパティ編集 + AIチャット */}
        <aside className="hairline-l glass flex w-72 shrink-0 flex-col lg:w-80">
          <div className="min-h-0 flex-1">
            <ErrorBoundary label="編集パネル" onReset={safeReset}>
              <PropertyPanel />
            </ErrorBoundary>
          </div>
          <div className="hairline-t h-80 shrink-0">
            <ErrorBoundary label="AIチャット" onReset={safeReset}>
              <ChatPanel />
            </ErrorBoundary>
          </div>
        </aside>
      </div>
    </div>
  );
}
