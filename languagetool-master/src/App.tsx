import React, { useEffect, useMemo, useRef, useState } from "react";

type LTReplacement = { value: string };
type LTContext = { text: string; offset: number; length: number };
type LTMatch = {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  context: LTContext;
  rule?: { issueType?: string; category?: { name?: string } };
  replacements: LTReplacement[];
};

const API_BASE =
  (import.meta as any).env?.VITE_LT_API_BASE?.toString() ||
  "https://languagetool-master.fly.dev";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function computeStats(text: string) {
  const words = (text.trim().match(/\S+/g) || []).length;
  const chars = text.length;
  const sentences = (text.match(/[.!?]+/g) || []).length;
  return { words, chars, sentences };
}

function applyFix(text: string, match: LTMatch, replacement: string) {
  const before = text.slice(0, match.offset);
  const after = text.slice(match.offset + match.length);
  return before + replacement + after;
}

function extractSnippet(text: string, match: LTMatch) {
  const start = clamp(match.offset - 28, 0, text.length);
  const end = clamp(match.offset + match.length + 28, 0, text.length);
  const left = text.slice(start, match.offset);
  const mid = text.slice(match.offset, match.offset + match.length);
  const right = text.slice(match.offset + match.length, end);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return { prefix, left, mid, right, suffix };
}

async function ltCheck(text: string, language: string, signal?: AbortSignal) {
  const body = new URLSearchParams();
  body.set("text", text);
  body.set("language", language);

  const res = await fetch(`${API_BASE}/v2/check`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`LanguageTool error ${res.status}: ${msg || res.statusText}`);
  }
  const json = await res.json();
  return (json.matches || []) as LTMatch[];
}

export default function App() {
  const [docTitle, setDocTitle] = useState("Untitled doc");
  const [language, setLanguage] = useState("en-US");
  const [text, setText] = useState(
    "This are bad sentence.\n\nPaste or type text here. Suggestions will appear on the right."
  );
  const [matches, setMatches] = useState<LTMatch[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const debouncedText = useDebounced(text, 650);
  const stats = useMemo(() => computeStats(text), [text]);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Don’t spam checks for tiny input
    if (debouncedText.trim().length < 3) {
      setMatches([]);
      setErr(null);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setErr(null);

    ltCheck(debouncedText, language, ac.signal)
      .then((m) => {
        setMatches(m);
        setSelectedIdx(0);
      })
      .catch((e: any) => {
        if (e?.name === "AbortError") return;
        setErr(e?.message || "Failed to check text");
        setMatches([]);
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [debouncedText, language]);

  const selected = matches[selectedIdx];

  function onApply(repl: string) {
    if (!selected) return;
    const next = applyFix(text, selected, repl);
    setText(next);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        {/* Left rail */}
        <aside className="w-[260px] border-r border-slate-200 bg-white">
          <div className="px-5 py-4 flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-600" />
            <div className="leading-tight">
              <div className="font-semibold">UpCube Write</div>
              <div className="text-xs text-slate-500">Grammar workspace</div>
            </div>
          </div>

          <nav className="px-3 pb-4">
            <div className="text-xs font-semibold text-slate-500 px-3 pt-3 pb-2">
              Docs
            </div>

            <button className="w-full text-left px-3 py-2 rounded-xl bg-slate-100 border border-slate-200">
              <div className="text-sm font-medium">Current document</div>
              <div className="text-xs text-slate-500 truncate">{docTitle}</div>
            </button>

            <div className="mt-4 space-y-1">
              {[
                "All documents",
                "Drafts",
                "Templates",
                "Shared",
                "Trash",
                "Settings",
              ].map((x) => (
                <button
                  key={x}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 text-sm text-slate-700"
                >
                  {x}
                </button>
              ))}
            </div>

            <div className="mt-6 px-3">
              <div className="text-xs font-semibold text-slate-500 mb-2">
                Language
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de-DE">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
              </select>
              <div className="text-xs text-slate-500 mt-2">
                API: <span className="font-mono">{API_BASE}</span>
              </div>
            </div>
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col">
          {/* Top bar */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="text-lg font-semibold bg-transparent outline-none focus:ring-2 focus:ring-emerald-200 rounded-lg px-2 py-1"
              />
              <span className="text-xs text-slate-500">
                {loading ? "Checking…" : err ? "Error" : "Ready"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-3 text-xs text-slate-600">
                <span>{stats.words} words</span>
                <span>•</span>
                <span>{stats.sentences} sentences</span>
                <span>•</span>
                <span>{stats.chars} chars</span>
              </div>

              <button className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700">
                Share
              </button>
            </div>
          </header>

          {/* Content split */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px]">
            {/* Editor */}
            <section className="p-6">
              <div className="mx-auto max-w-3xl">
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div className="text-sm font-medium">Editor</div>
                    <div className="text-xs text-slate-500">
                      {matches.length} suggestions
                    </div>
                  </div>

                  <div className="p-5">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Type or paste…"
                      className="w-full min-h-[420px] resize-y rounded-xl border border-slate-200 bg-white p-4 text-[15px] leading-7 outline-none focus:ring-2 focus:ring-emerald-200"
                    />

                    {err && (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                        <div className="font-semibold">Couldn’t check text</div>
                        <div className="mt-1 opacity-90">{err}</div>
                        <div className="mt-2 text-xs opacity-80">
                          If this is a browser UI, your API must allow CORS (or
                          you need a proxy).
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 text-xs text-slate-500">
                  Tip: This UI is “Grammarly-style” in layout (rail + editor +
                  suggestions), but built fresh for your product.
                </div>
              </div>
            </section>

            {/* Suggestions */}
            <aside className="border-l border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Suggestions</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Improve clarity & correctness
                  </div>
                </div>

                <div
                  className={cx(
                    "text-xs px-2 py-1 rounded-full border",
                    loading
                      ? "border-slate-200 bg-slate-50 text-slate-600"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  )}
                >
                  {loading ? "Checking" : "Live"}
                </div>
              </div>

              <div className="mt-4 space-y-2 max-h-[78vh] overflow-auto pr-1">
                {matches.length === 0 && !err && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="font-medium">No suggestions yet</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Type a few sentences and we’ll surface issues here.
                    </div>
                  </div>
                )}

                {matches.map((m, idx) => {
                  const isActive = idx === selectedIdx;
                  const type =
                    m.rule?.issueType ||
                    m.rule?.category?.name ||
                    "Suggestion";
                  return (
                    <button
                      key={`${m.offset}-${m.length}-${idx}`}
                      onClick={() => setSelectedIdx(idx)}
                      className={cx(
                        "w-full text-left rounded-2xl border p-4 transition",
                        isActive
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium text-sm leading-snug">
                          {m.shortMessage || m.message}
                        </div>
                        <span className="text-[11px] px-2 py-1 rounded-full border border-slate-200 bg-white text-slate-600">
                          {type}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-slate-600 line-clamp-2">
                        {m.message}
                      </div>

                      {m.replacements?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {m.replacements.slice(0, 3).map((r) => (
                            <span
                              key={r.value}
                              className="text-xs rounded-full bg-white border border-slate-200 px-2 py-1 text-slate-700"
                            >
                              {r.value}
                            </span>
                          ))}
                          {m.replacements.length > 3 && (
                            <span className="text-xs text-slate-500">
                              +{m.replacements.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected detail */}
              {selected && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold">Preview</div>
                  <div className="mt-2 text-sm leading-6 text-slate-800">
                    {(() => {
                      const s = extractSnippet(text, selected);
                      return (
                        <>
                          <span className="text-slate-500">{s.prefix}</span>
                          <span className="text-slate-700">{s.left}</span>
                          <span className="bg-amber-200/70 rounded px-1">
                            {s.mid || " "}
                          </span>
                          <span className="text-slate-700">{s.right}</span>
                          <span className="text-slate-500">{s.suffix}</span>
                        </>
                      );
                    })()}
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    {(selected.replacements || []).slice(0, 4).map((r) => (
                      <button
                        key={r.value}
                        onClick={() => onApply(r.value)}
                        className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-100"
                      >
                        Apply: <span className="font-medium">{r.value}</span>
                      </button>
                    ))}
                    {(selected.replacements || []).length === 0 && (
                      <div className="text-xs text-slate-500">
                        No direct replacements available for this item.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
