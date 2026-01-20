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
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
      <span data-idx="${i}" class="ucw-highlight">
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
    "This are bad sentence.\n\nWelcome to UpCube Writer — your writing assistant."
  );

  const [matches, setMatches] = useState<LTMatch[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedText = useDebounced(text, 600);
  const stats = useMemo(() => computeStats(text), [text]);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debouncedText.trim().length < 3) {
      setMatches([]);
      setSelectedIdx(-1);
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
        setSelectedIdx(m.length ? 0 : -1);
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

  const selected = selectedIdx >= 0 ? matches[selectedIdx] : undefined;

  function onPickSuggestion(i: number) {
    setSelectedIdx(i);
  }

  const sevLabel: Record<string, string> = {
    error: "Critical",
    style: "Style",
    info: "Suggestion",
  };

  return (
    <div className="ucw-app">
      <aside className="ucw-sidebar">
        <div className="ucw-brand">
          <div className="ucw-logo">U</div>
          <div>
            <div className="ucw-brand-title">UpCube Writer</div>
            <div className="ucw-brand-subtitle">Smart writing assistant</div>
          </div>
        </div>

        <div className="ucw-field">
          <label className="ucw-label">Writing language</label>
          <select
            className="ucw-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>

        <div className="ucw-muted ucw-footer-note">
          Powered by UpCube Language Engine
        </div>
      </aside>

      <main className="ucw-main">
        <header className="ucw-topbar">
          <div className="ucw-doc">
            <input
              className="ucw-title-input"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              aria-label="Document title"
            />
            <div className="ucw-submeta">
              {stats.words} words • {stats.sentences} sentences
            </div>
          </div>

          <div className="ucw-status">
            <span className="ucw-pill">Live feedback</span>
          </div>
        </header>

        <div className="ucw-content">
          <section className="ucw-editorPane">
            <div className="ucw-card">
              <Editor
                content={text}
                onChange={setText}
                highlights={renderHighlightedText(text, matches)}
                onWordClick={(idx) => setSelectedIdx(idx)}
              />
            </div>

            {error && (
              <div className="ucw-alert">
                <div className="ucw-alert-title">Review failed</div>
                <div className="ucw-alert-body">{error}</div>
              </div>
            )}
          </section>

          <aside className="ucw-rightPane">
            <div className="ucw-rightHeader">
              <div className="ucw-rightTitle">Suggestions</div>

              {loading ? (
                <div className="ucw-loading">
                  <span className="ucw-spinner" />
                  Analyzing…
                </div>
              ) : (
                <div className="ucw-muted">{matches.length} found</div>
              )}
            </div>

            {!loading && matches.length === 0 && !error && (
              <div className="ucw-empty">
                <div className="ucw-emptyTitle">All clear</div>
                <div className="ucw-emptyBody">
                  No suggestions right now. Keep writing.
                </div>
              </div>
            )}

            <div className="ucw-suggestions">
              {matches.map((m, i) => {
                const sev = getSeverity(m);
                const isActive = i === selectedIdx;

                return (
                  <button
                    key={i}
                    className={`ucw-suggestion ${sev} ${
                      isActive ? "active" : ""
                    }`}
                    onClick={() => onPickSuggestion(i)}
                    type="button"
                  >
                    <div className="ucw-suggestionTop">
                      <div className="ucw-suggestionTitle">
                        {m.shortMessage || m.message}
                      </div>
                      <span className="ucw-tag">{sevLabel[sev]}</span>
                    </div>

                    <div className="ucw-suggestionBody">{m.message}</div>

                    {m.replacements?.length ? (
                      <div className="ucw-chips">
                        {m.replacements.slice(0, 3).map((r) => (
                          <span key={r.value} className="ucw-chip">
                            {r.value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="ucw-apply">
                <div className="ucw-applyTitle">Apply correction</div>

                <div className="ucw-applyList">
                  {selected.replacements.slice(0, 5).map((r) => (
                    <button
                      key={r.value}
                      className="ucw-applyBtn"
                      onClick={() => applyFix(r.value)}
                      type="button"
                    >
                      Replace with: <strong>{r.value}</strong>
                    </button>
                  ))}
                </div>

                <button
                  className="ucw-ignore"
                  onClick={() => setSelectedIdx(-1)}
                  type="button"
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
