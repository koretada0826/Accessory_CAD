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
      <div className="hairline-b flex items-center gap-2 px-4 py-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-gold-sheen">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="#0a0b11"><path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8z" /></svg>
        </span>
        <h3 className="text-[10px] font-medium uppercase tracking-luxe text-ink-400">AI アシスタント</h3>
        <HelpHint text="「石を入れて」「13号に」「もっと細く」など、話し言葉で調整できます。下の候補をタップしてもOK。" side="left" />
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3.5">
        {chat.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-gold-sheen text-ink-950'
                  : 'border border-ink-700/60 bg-ink-850/60 text-ink-100'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && <div className="text-[11px] text-gold-400/80">考え中…</div>}
      </div>

      {/* サジェスト */}
      <div className="flex flex-wrap gap-1.5 px-3.5 pb-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => submit(s)} className="rounded-full border border-ink-700/70 bg-ink-850/50 px-2.5 py-1 text-[10px] text-ink-300 transition-colors hover:border-gold-500/50 hover:text-white">
            {s}
          </button>
        ))}
      </div>

      <div className="hairline-t flex items-center gap-2 p-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit(input)}
          placeholder="例: もう少しゴシックに、石を大きく…"
          className="flex-1 rounded-xl border border-ink-700 bg-ink-950/50 px-3 py-2 text-xs text-white outline-none transition-colors placeholder:text-ink-600 focus:border-gold-500/60 focus:bg-ink-900"
        />
        <button
          onClick={() => submit(input)}
          disabled={busy}
          className="rounded-xl bg-gold-sheen px-3.5 py-2 text-xs font-medium text-ink-950 shadow-gold transition-transform hover:-translate-y-px disabled:opacity-50"
        >
          送信
        </button>
      </div>
    </div>
  );
}
