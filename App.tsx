import React, { useEffect, useMemo, useState } from "react";
import Editor from "./Editor";
import "./index.css";

type LTMatch = {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule?: { issueType?: string; category?: { name?: string } };
};

type DocItem = {
  id: string;
  title: string;
  text: string;
  updatedAt: number;
};

const STORAGE_KEY = "upcube_write_docs_v1";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getWordRangeAt(text: string, idx: number) {
  const safe = clamp(idx, 0, Math.max(0, text.length - 1));
  let start = safe;
  let end = safe;

  while (start > 0 && /\S/.test(text[start - 1])) start--;
  while (end < text.length && /\S/.test(text[end])) end++;

  return { start, end };
}

function replaceRange(text: string, start: number, end: number, replacement: string) {
  return text.slice(0, start) + replacement + text.slice(end);
}

function buildHighlightedHtml(text: string, matches: LTMatch[], selectedIdx: number | null) {
  // Convert offsets into non-overlapping spans (LanguageTool usually doesn't overlap, but be safe)
  const spans = matches
    .map((m, i) => ({ ...m, _i: i }))
    .sort((a, b) => a.offset - b.offset);

  let out = "";
  let cursor = 0;

  for (const s of spans) {
    const start = clamp(s.offset, 0, text.length);
    const end = clamp(s.offset + s.length, 0, text.length);
    if (end <= cursor) continue; // overlap/invalid

    // normal chunk
    out += escapeHtml(text.slice(cursor, start));

    // highlighted chunk
    const chunk = escapeHtml(text.slice(start, end));
    const isSelected = selectedIdx === s._i;

    out += `<span class="hlt-word ${isSelected ? "is-selected" : ""}" data-idx="${s._i}">${chunk}</span>`;

    cursor = end;
  }

  out += escapeHtml(text.slice(cursor));

  // Preserve line breaks in HTML
  return out.replaceAll("\n", "<br/>");
}

export default function App() {
  const [docs, setDocs] = useState<DocItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initial: DocItem = {
          id: uid(),
          title: "Untitled document",
          text: "This are bad sentence. Welcome to UpCube Writer — your AI-powered writing assistant.",
          updatedAt: Date.now(),
        };
        return [initial];
      }
      const parsed = JSON.parse(raw) as DocItem[];
      return Array.isArray(parsed) && parsed.length ? parsed : [];
    } catch {
      return [];
    }
  });

  const [activeId, setActiveId] = useState<string>(() => (docs[0]?.id ? docs[0].id : ""));
  const activeDoc = useMemo(() => docs.find((d) => d.id === activeId) ?? docs[0], [docs, activeId]);

  const [language, setLanguage] = useState("en-US");
  const [matches, setMatches] = useState<LTMatch[]>([]);
  const [selectedMatchIdx, setSelectedMatchIdx] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<string>("");

  const activeText = activeDoc?.text ?? "";

  // persist docs
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    } catch {
      // ignore
    }
  }, [docs]);

  // keep activeId valid
  useEffect(() => {
    if (!docs.length) return;
    if (!activeId || !docs.some((d) => d.id === activeId)) {
      setActiveId(docs[0].id);
    }
  }, [docs, activeId]);

  const highlightedHtml = useMemo(() => {
    return buildHighlightedHtml(activeText, matches, selectedMatchIdx);
  }, [activeText, matches, selectedMatchIdx]);

  function updateActiveDoc(patch: Partial<DocItem>) {
    if (!activeDoc) return;
    setDocs((prev) =>
      prev.map((d) =>
        d.id === activeDoc.id
          ? {
              ...d,
              ...patch,
              updatedAt: Date.now(),
            }
          : d
      )
    );
  }

  function newDoc() {
    const doc: DocItem = {
      id: uid(),
      title: "Untitled document",
      text: "",
      updatedAt: Date.now(),
    };
    setDocs((prev) => [doc, ...prev]);
    setActiveId(doc.id);
    setMatches([]);
    setSelectedMatchIdx(null);
    setStatus("");
  }

  function deleteDoc(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setMatches([]);
    setSelectedMatchIdx(null);
    setStatus("");
  }

  async function checkGrammar(text: string) {
    setIsChecking(true);
    setStatus("Checking…");
    setSelectedMatchIdx(null);

    try {
      // If you later host your own LT API, replace this endpoint.
      const res = await fetch("https://api.languagetool.org/v2/check", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          text,
          language,
        }),
      });

      if (!res.ok) {
        throw new Error(`LanguageTool error: ${res.status}`);
      }

      const data = (await res.json()) as { matches: LTMatch[] };
      setMatches(Array.isArray(data.matches) ? data.matches : []);
      setStatus(`Found ${data.matches?.length ?? 0} suggestion(s).`);
    } catch (e: any) {
      setMatches([]);
      setStatus(e?.message ? `Error: ${e.message}` : "Error checking text.");
    } finally {
      setIsChecking(false);
    }
  }

  // Debounced checking
  useEffect(() => {
    if (!activeDoc) return;

    const t = window.setTimeout(() => {
      const txt = activeDoc.text.trim();
      if (!txt) {
        setMatches([]);
        setSelectedMatchIdx(null);
        setStatus("");
        return;
      }
      checkGrammar(activeDoc.text);
    }, 600);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc?.text, language]);

  function applyReplacement(matchIdx: number, replacement: string) {
    if (!activeDoc) return;
    const m = matches[matchIdx];
    if (!m) return;

    // Apply to the current text using offsets (best effort)
    const start = m.offset;
    const end = m.offset + m.length;

    const next = replaceRange(activeDoc.text, start, end, replacement);
    updateActiveDoc({ text: next });

    // After apply, clear selection
    setSelectedMatchIdx(null);
  }

  function ignoreSuggestion(matchIdx: number) {
    setMatches((prev) => prev.filter((_, i) => i !== matchIdx));
    setSelectedMatchIdx(null);
  }

  const selected = selectedMatchIdx !== null ? matches[selectedMatchIdx] : null;
  const selectedReplacements = selected?.replacements ?? [];

  return (
    <div className="app-shell">
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">U</div>
          <div className="brand-meta">
            <div className="brand-name">UpCube Write</div>
            <div className="brand-sub">Smart writing assistant</div>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="select">
            <label className="sr-only" htmlFor="lang">
              Language
            </label>
            <select id="lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>

          <button className="btn btn-primary" onClick={newDoc}>
            New doc
          </button>
        </div>
      </header>

      <div className="layout">
        {/* Left sidebar (docs) */}
        <aside className="sidebar">
          <div className="sidebar-head">
            <div className="sidebar-title">Docs</div>
          </div>

          <div className="doclist">
            {docs.map((d) => (
              <button
                key={d.id}
                className={`docitem ${d.id === activeId ? "is-active" : ""}`}
                onClick={() => setActiveId(d.id)}
                type="button"
              >
                <div className="docitem-title">{d.title || "Untitled document"}</div>
                <div className="docitem-meta">
                  {new Date(d.updatedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>

                <span
                  className="docitem-trash"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (docs.length > 1) deleteDoc(d.id);
                  }}
                  title={docs.length > 1 ? "Delete" : "Keep at least 1 doc"}
                  role="button"
                >
                  ✕
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main editor + suggestions */}
        <main className="main">
          <div className="main-grid">
            {/* Editor column */}
            <section className="card editor-card">
              <div className="card-head">
                <input
                  className="title-input"
                  value={activeDoc?.title ?? ""}
                  onChange={(e) => updateActiveDoc({ title: e.target.value })}
                  placeholder="Untitled document"
                />

                <div className="card-head-right">
                  <div className={`pill ${isChecking ? "is-warn" : matches.length ? "is-good" : "is-muted"}`}>
                    {isChecking ? "Checking…" : matches.length ? `${matches.length} suggestion(s)` : "No suggestions"}
                  </div>
                </div>
              </div>

              <div className="editor-wrap">
                <Editor
                  content={activeText}
                  onChange={(txt) => updateActiveDoc({ text: txt })}
                  highlights={highlightedHtml}
                  onWordClick={(idx) => setSelectedMatchIdx(idx)}
                />
              </div>

              <div className="status-row">
                <div className="status-text">{status}</div>
              </div>
            </section>

            {/* Suggestions column */}
            <aside className="card suggestions-card">
              <div className="card-head">
                <div className="card-title">Suggestions</div>
              </div>

              {isChecking ? (
                <div className="empty">
                  <div className="spinner" />
                  <div>Analyzing your writing…</div>
                </div>
              ) : matches.length === 0 ? (
                <div className="empty">
                  <div className="empty-title">All clear</div>
                  <div className="empty-sub">Keep typing — suggestions will appear here.</div>
                </div>
              ) : (
                <div className="suggestions">
                  {matches.map((m, i) => {
                    const title =
                      m.shortMessage ||
                      m.rule?.category?.name ||
                      m.rule?.issueType ||
                      "Suggestion";

                    return (
                      <button
                        key={`${m.offset}-${m.length}-${i}`}
                        className={`suggestion ${selectedMatchIdx === i ? "is-active" : ""}`}
                        onClick={() => setSelectedMatchIdx(i)}
                        type="button"
                      >
                        <div className="suggestion-top">
                          <div className="suggestion-title">{title}</div>
                          <div className="suggestion-tag">
                            {(m.rule?.issueType || "issue").toLowerCase()}
                          </div>
                        </div>
                        <div className="suggestion-msg">{m.message}</div>

                        <div className="suggestion-actions">
                          <button
                            className="btn btn-ghost"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              ignoreSuggestion(i);
                            }}
                            type="button"
                          >
                            Ignore
                          </button>

                          <button
                            className="btn btn-primary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const rep = m.replacements?.[0]?.value;
                              if (rep) applyReplacement(i, rep);
                            }}
                            disabled={!m.replacements?.length}
                            type="button"
                          >
                            Apply
                          </button>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Details panel for selected suggestion */}
              {selected && (
                <div className="detail">
                  <div className="detail-head">Apply correction</div>

                  {selectedReplacements.length ? (
                    <div className="replacements">
                      {selectedReplacements.slice(0, 6).map((r, idx) => (
                        <button
                          key={`${r.value}-${idx}`}
                          className="chip"
                          onClick={() => {
                            if (selectedMatchIdx !== null) applyReplacement(selectedMatchIdx, r.value);
                          }}
                          type="button"
                        >
                          {r.value}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="detail-sub">No replacement offered — try rewriting this phrase.</div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
