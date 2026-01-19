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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function computeStats(text: string) {
  const words = (text.trim().match(/\S+/g) || []).length;
  const chars = text.length;
  const sentences = (text.match(/[.!?]+/g) || []).length;
  return { words, chars, sentences };
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
    throw new Error("LanguageTool API error");
  }

  const json = await res.json();
  return (json.matches || []) as LTMatch[];
}

function getSeverity(match: LTMatch) {
  const t = match.rule?.issueType || "";
  if (t === "misspelling" || t === "grammar") return "error";
  if (t === "style") return "style";
  return "info";
}

function renderHighlightedText(text: string, matches: LTMatch[]) {
  let result = "";
  let lastIndex = 0;

  matches.forEach((m, i) => {
    result += escapeHtml(text.slice(lastIndex, m.offset));

    result += `
      <span
        data-idx="${i}"
        class="underline decoration-amber-400 decoration-2 cursor-pointer bg-amber-100/50 rounded-sm"
      >
        ${escapeHtml(text.slice(m.offset, m.offset + m.length))}
      </span>
    `;

    lastIndex = m.offset + m.length;
  });

  result += escapeHtml(text.slice(lastIndex));
  return result;
}

export default function App() {
  const [docTitle, setDocTitle] = useState("My Document");
  const [language, setLanguage] = useState("en-US");
  const [text, setText] = useState(
    "This are bad sentence.\n\nStart typing and grammar suggestions will appear."
  );

  const [matches, setMatches] = useState<LTMatch[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedText = useDebounced(text, 600);
  const stats = useMemo(() => computeStats(text), [text]);

  const editorRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debouncedText.trim().length < 3) {
      setMatches([]);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);

    ltCheck(debouncedText, language, ac.signal)
      .then((m) => {
        setMatches(m);
        setSelectedIdx(0);
      })
      .catch(() => setError("Could not analyze text"))
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [debouncedText, language]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = renderHighlightedText(text, matches);
    }
  }, [matches, text]);

  function applyFix(replacement: string) {
    const m = matches[selectedIdx];
    if (!m) return;

    const before = text.slice(0, m.offset);
    const after = text.slice(m.offset + m.length);

    setText(before + replacement + after);
  }

  function handleEditorClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const idx = target.getAttribute("data-idx");

    if (idx) {
      setSelectedIdx(Number(idx));
    }
  }

  const selected = matches[selectedIdx];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* LEFT NAV */}
      <aside className="w-[240px] border-r bg-white p-4">
        <h2 className="text-lg font-bold mb-4">UpCube Write</h2>

        <div className="mb-4">
          <label className="text-xs">Language</label>
          <select
            className="w-full border rounded p-2 text-sm"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">
          API: {API_BASE}
        </div>
      </aside>

      {/* MAIN AREA */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b flex items-center px-6 justify-between">
          <input
            className="text-lg font-semibold outline-none"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
          />

          <div className="text-sm text-slate-600">
            {stats.words} words • {stats.sentences} sentences
          </div>
        </header>

        <div className="flex flex-1">
          {/* EDITOR */}
          <section className="flex-1 p-6">
            <div
              ref={editorRef}
              onClick={handleEditorClick}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) =>
                setText((e.target as HTMLDivElement).innerText)
              }
              className="w-full min-h-[450px] bg-white border rounded p-4 outline-none leading-7"
            />

            {error && (
              <div className="mt-4 text-red-600 text-sm">{error}</div>
            )}
          </section>

          {/* SUGGESTIONS PANEL */}
          <aside className="w-[360px] border-l bg-white p-4 overflow-auto">
            <h3 className="font-semibold mb-2">Writing Insights</h3>

            {loading && <div className="text-sm">Checking…</div>}

            {!loading && matches.length === 0 && (
              <div className="text-center mt-10 text-slate-600">
                <div className="text-lg font-semibold">All clear 🎉</div>
                <div className="text-sm mt-1">
                  Your writing looks polished and correct.
                </div>
              </div>
            )}

            {matches.map((m, i) => {
              const sev = getSeverity(m);

              return (
                <div
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  className={`border rounded p-3 mb-2 cursor-pointer ${
                    i === selectedIdx ? "bg-emerald-50" : "bg-white"
                  } ${
                    sev === "error"
                      ? "border-red-300"
                      : sev === "style"
                      ? "border-yellow-300"
                      : "border-blue-300"
                  }`}
                >
                  <div className="font-medium text-sm">
                    {m.shortMessage || m.message}
                  </div>

                  <div className="text-xs mt-1 text-slate-600">
                    {m.message}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.replacements.slice(0, 3).map((r) => (
                      <span
                        key={r.value}
                        className="px-2 py-1 text-xs border rounded bg-white"
                      >
                        {r.value}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {selected && (
              <div className="mt-4 border rounded p-3 bg-slate-50">
                <h4 className="font-semibold mb-2">Apply Fix</h4>

                {selected.replacements.slice(0, 5).map((r) => (
                  <button
                    key={r.value}
                    onClick={() => applyFix(r.value)}
                    className="block w-full text-left border bg-white rounded px-3 py-2 text-sm mb-2"
                  >
                    Replace with: <b>{r.value}</b>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
