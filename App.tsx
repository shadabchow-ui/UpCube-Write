import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor from "./Editor";

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

  if (!res.ok) throw new Error("Language service unavailable");

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
        class="underline decoration-amber-400 decoration-2 cursor-pointer bg-amber-100/40 rounded-sm transition-colors hover:bg-amber-200/60"
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
  const [docTitle, setDocTitle] = useState("Untitled Document");
  const [language, setLanguage] = useState("en-US");
  const [text, setText] = useState(
    "This are bad sentence.\n\nWelcome to UpCube Writer – your AI-powered writing assistant."
  );

  const [matches, setMatches] = useState<LTMatch[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedText = useDebounced(text, 600);
  const stats = useMemo(() => computeStats(text), [text]);

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
      .catch(() => setError("Unable to review your text right now"))
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [debouncedText, language]);

  function applyFix(replacement: string) {
    const m = matches[selectedIdx];
    if (!m) return;

    const before = text.slice(0, m.offset);
    const after = text.slice(m.offset + m.length);

    setText(before + replacement + after);
  }

  const selected = matches[selectedIdx];

  const severityStyles: Record<string, string> = {
    error: "border-l-4 border-red-500 bg-red-50",
    style: "border-l-4 border-amber-400 bg-amber-50",
    info: "border-l-4 border-sky-400 bg-sky-50",
  };

  const severityLabels: Record<string, string> = {
    error: "Critical Issue",
    style: "Style Suggestion",
    info: "Improvement",
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <aside className="w-[250px] border-r bg-white p-5">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
            U
          </div>

          <div>
            <div className="font-semibold text-lg">UpCube Writer</div>
            <div className="text-xs text-slate-500">
              Smart Writing Assistant
            </div>
          </div>
        </div>

        <div className="mb-5">
          <label className="text-xs text-slate-500">Writing Language</label>

          <select
            className="w-full mt-1 border rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 mt-8">
          Powered by UpCube Language Engine
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b flex items-center px-6 justify-between">
          <input
            className="text-lg font-semibold outline-none bg-transparent focus:ring-2 focus:ring-indigo-200 rounded-lg px-2"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
          />

          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-600">
              {stats.words} words • {stats.sentences} sentences
            </div>

            <div className="px-3 py-1 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
              Live feedback enabled
            </div>
          </div>
        </header>

        <div className="flex flex-1">
          <section className="flex-1 p-6">
            <Editor
              content={text}
              onChange={setText}
              highlights={renderHighlightedText(text, matches)}
              onWordClick={(idx) => setSelectedIdx(idx)}
            />

            {error && (
              <div className="mt-4 text-red-600 text-sm bg-red-50 p-3 rounded-xl">
                {error}
              </div>
            )}
          </section>

          <aside className="w-[380px] border-l bg-white p-5 overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[16px]">Suggestions</h3>

              {loading && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                  Analyzing…
                </div>
              )}
            </div>

            {!loading && matches.length === 0 && !error && (
              <div className="text-center mt-16 text-slate-600">
                <div className="text-2xl font-semibold">All Clear 🎉</div>

                <div className="text-sm mt-2">
                  Your writing looks polished and professional.
                </div>
              </div>
            )}

            {matches.map((m, i) => {
              const sev = getSeverity(m);

              return (
                <div
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  className={`transition transform hover:-translate-y-[1px] hover:shadow-sm cursor-pointer rounded-xl p-4 mb-3 ${
                    severityStyles[sev]
                  } ${i === selectedIdx ? "ring-2 ring-indigo-200" : ""}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-medium text-[15px]">
                      {i + 1}. {m.shortMessage || m.message}
                    </div>

                    <span className="text-xs px-2 py-1 bg-white border rounded-full">
                      {severityLabels[sev]}
                    </span>
                  </div>

                  <div className="text-[13px] mt-1 text-slate-600">
                    {m.message}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.replacements.slice(0, 3).map((r) => (
                      <span
                        key={r.value}
                        className="px-2 py-1 text-xs border rounded-full bg-white"
                      >
                        {r.value}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {selected && (
              <div className="mt-6 border rounded-2xl p-4 bg-slate-50">
                <h4 className="font-semibold mb-3 text-sm">
                  Apply Correction
                </h4>

                {selected.replacements.slice(0, 5).map((r) => (
                  <button
                    key={r.value}
                    onClick={() => applyFix(r.value)}
                    className="block w-full text-left border bg-white rounded-xl px-3 py-2 text-[13px] mb-2 hover:bg-indigo-50 transition"
                  >
                    Replace with: <b>{r.value}</b>
                  </button>
                ))}

                <button
                  onClick={() => setSelectedIdx(-1)}
                  className="mt-2 text-xs text-slate-500 hover:text-slate-800"
                >
                  Ignore this suggestion
                </button>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
