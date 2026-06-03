'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  /** フォールバック領域のラベル（例: 3Dビュー） */
  label?: string;
  /** 「安全な状態に戻す」押下時の処理（例: 既定デザインに戻す） */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * エラーバウンダリ。配下のレンダリング例外を捕捉し、白画面化を防いで
 * フレンドリーなフォールバックを表示する。「誰が触っても壊れない」ための保険。
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // 原因が分かるようログを残す（失敗時に理由が分かる方針）
    // eslint-disable-next-line no-console
    console.error('[Atelier ErrorBoundary]', this.props.label ?? '', error, info);
  }

  private retry = () => this.setState({ hasError: false, message: '' });
  private safeReset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-3xl">😵‍💫</div>
        <div className="text-sm font-semibold text-white">
          {this.props.label ?? 'この部分'}で問題が発生しました
        </div>
        <div className="max-w-md text-[11px] leading-relaxed text-ink-400">
          表示の復元を試せます。直らない場合は「安全な状態に戻す」で既定のデザインに戻してください。
          {this.state.message && (
            <span className="mt-1 block break-all text-ink-600">（{this.state.message}）</span>
          )}
        </div>
        <div className="mt-1 flex gap-2">
          <button onClick={this.retry} className="rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-ink-200 hover:border-ink-500">
            もう一度表示
          </button>
          {this.props.onReset && (
            <button onClick={this.safeReset} className="rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 px-3 py-1.5 text-xs font-medium text-ink-950">
              安全な状態に戻す
            </button>
          )}
        </div>
      </div>
    );
  }
}
