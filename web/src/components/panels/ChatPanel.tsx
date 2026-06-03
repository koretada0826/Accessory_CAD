'use client';

import { useState, useRef, useEffect } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { HelpHint } from '@/components/ui/HelpHint';

const SUGGESTIONS = ['もう少し細く', '石を中央に', '13号にして', 'ゴシックに', '厚くして', 'ハートにして'];

export default function ChatPanel() {
  const chat = useDesignStore((s) => s.chat);
  const sendChat = useDesignStore((s) => s.sendChat);
  const busy = useDesignStore((s) => s.busy);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput('');
    void sendChat(t);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-ink-700 px-3 py-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-gold-400 to-accent-500 text-[11px]">✦</span>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">AIデザインアシスタント</h3>
        <HelpHint text="「石を入れて」「13号に」「もっと細く」など、話し言葉で調整できます。下の候補をタップしてもOK。" side="left" />
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {chat.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                m.role === 'user' ? 'bg-gold-500 text-ink-950' : 'bg-ink-800 text-ink-100'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && <div className="text-[11px] text-ink-500">考え中…</div>}
      </div>

      {/* サジェスト */}
      <div className="flex flex-wrap gap-1 px-3 pb-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => submit(s)} className="rounded-full border border-ink-700 bg-ink-850 px-2 py-0.5 text-[10px] text-ink-300 hover:border-gold-500 hover:text-white">
            {s}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-ink-700 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit(input)}
          placeholder="例: もう少しゴシックに、石を大きく…"
          className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-white outline-none placeholder:text-ink-600 focus:border-gold-500"
        />
        <button
          onClick={() => submit(input)}
          disabled={busy}
          className="rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 px-3 py-2 text-xs font-medium text-ink-950 disabled:opacity-50"
        >
          送信
        </button>
      </div>
    </div>
  );
}
