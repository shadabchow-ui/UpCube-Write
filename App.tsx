import React, { useEffect, useMemo, useState } from "react";
import Editor from "./Editor";

type IssueType = "Spelling" | "Grammar" | "Style";

type Suggestion = {
  id: string;
  type: IssueType;
  title: string;
  message: string;
  replacement?: string;
  severity: "Low" | "Medium" | "High";
  wordIndex: number; // index into words array
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function App() {
  const [text, setText] = useState(
    "This are bad sentence. Welcome to UpCube Writer — your AI-powered writing assistant."
  );
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const words = useMemo(() => {
    return text
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  }, [text]);

  // Very simple local “checks” (placeholder until you wire the API)
  const suggestions: Suggestion[] = useMemo(() => {
    const items: Suggestion[] = [];

    // Example: "This are" => Grammar
    const idxThis = words.findIndex((w, i) => {
      const cur = w.toLowerCase().replace(/[^\w']/g, "");
      const next = (words[i + 1] || "").toLowerCase().replace(/[^\w']/g, "");
      return cur === "this" && next === "are";
    });
    if (idxThis !== -1) {
      items.push({
        id: "g1",
        type: "Grammar",
        title: "Grammatical problem: use ‘these’",
        message:
          "The singular demonstrative pronoun ‘this’ does not agree with the plural verb ‘are’. Did you mean “these”?",
        replacement: "These",
        severity: "High",
        wordIndex: idxThis,
      });
    }

    // Example: "are bad sentence" => Grammar/Style (rough)
    const idxSentence = words.findIndex((w) =>
      w.toLowerCase().includes("sentence")
    );
    if (idxSentence !== -1) {
      items.push({
        id: "s1",
        type: "Style",
        title: "Word choice",
        message:
          "Consider making this more natural. Example: “This sentence is incorrect.”",
        replacement: "sentence is incorrect",
        severity: "Medium",
        wordIndex: clamp(idxSentence - 1, 0, Math.max(0, words.length - 1)),
      });
    }

    // Example spelling: "UpCube" split or "Up Cube"
    const idxUp = words.findIndex((w) => w.toLowerCase() === "upcube");
    if (idxUp !== -1) {
      items.push({
        id: "sp1",
        type: "Spelling",
        title: "Consistency",
        message:
          "Keep brand spelling consistent. If you use “UpCube” elsewhere, keep it the same here.",
        replacement: "UpCube",
        severity: "Low",
        wordIndex: idxUp,
      });
    }

    return items;
  }, [words]);

  useEffect(() => {
    // Auto-select first issue
    if (!selectedIssueId && suggestions.length) {
      setSelectedIssueId(suggestions[0].id);
    }
    if (selectedIssueId && !suggestions.some((s) => s.id === selectedIssueId)) {
      setSelectedIssueId(suggestions[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions.length]);

  const selected = suggestions.find((s) => s.id === selectedIssueId) ?? null;

  // Build highlighted HTML for editor
  const highlightedHtml = useMemo(() => {
    if (!words.length) return "";

    const markSet = new Set<number>(suggestions.map((s) => s.wordIndex));

    const html = words
      .map((w, i) => {
        const safe = w.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        if (!markSet.has(i)) return safe;

        // Find the suggestion for that word index
        const s = suggestions.find((x) => x.wordIndex === i);
        const color =
          s?.type === "Spelling"
            ? "bg-amber-100 ring-amber-200"
            : s?.type === "Grammar"
            ? "bg-red-100 ring-red-200"
            : "bg-blue-100 ring-blue-200";

        return `<span data-idx="${i}" class="cursor-pointer rounded px-1 py-0.5 ring-1 ${color}">${safe}</span>`;
      })
      .join(" ");

    // wrap in paragraph so TipTap renders nicely
    return `<p>${html}</p>`;
  }, [words, suggestions]);

  const applySuggestion = (s: Suggestion) => {
    if (!s.replacement) return;
    const newWords = [...words];
    // Simple replacement: replace the word at wordIndex with replacement
    newWords[s.wordIndex] = s.replacement;
    setText(newWords.join(" "));
  };

  const ignoreSuggestion = (s: Suggestion) => {
    // In a real app, you'd store ignored IDs in state.
    // For now, just clear selection.
    if (selectedIssueId === s.id) setSelectedIssueId(null);
  };

  const severityBadge = (sev: Suggestion["severity"]) => {
    const cls =
      sev === "High"
        ? "bg-red-100 text-red-700"
        : sev === "Medium"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-700";
    return (
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cls}`}>
        {sev} Issue
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">
              U
            </div>
            <div>
              <div className="font-bold leading-tight">UpCube Writer</div>
              <div className="text-xs text-slate-500">
                Smart Writing Assistant
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-sm">
              Export
            </button>
            <button className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm">
              Save
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-6">
        {/* Left: Editor */}
        <section className="col-span-12 lg:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Writing</div>
              <div className="text-xs text-slate-500">
                Live feedback enabled
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select className="px-3 py-2 rounded-xl border bg-white text-sm">
                <option>Language: English (US)</option>
              </select>
              <span className="text-xs text-slate-500">
                {words.length} words
              </span>
            </div>
          </div>

          <Editor
            content={text}
            onChange={setText}
            highlights={highlightedHtml}
            onWordClick={(idx) => {
              const s = suggestions.find((x) => x.wordIndex === idx);
              if (s) setSelectedIssueId(s.id);
            }}
          />

          <div className="mt-4 text-xs text-slate-500">
            Powered by UpCube Language Engine
          </div>
        </section>

        {/* Right: Suggestions */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="sticky top-[72px]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold">Suggestions</div>
                <div className="text-xs text-slate-500">
                  {suggestions.length} issues found
                </div>
              </div>
              <button className="text-sm px-3 py-2 rounded-xl border bg-white hover:bg-slate-50">
                Recheck
              </button>
            </div>

            <div className="space-y-3">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedIssueId(s.id)}
                  className={[
                    "w-full text-left rounded-2xl border bg-white p-4 shadow-sm hover:shadow transition",
                    selectedIssueId === s.id
                      ? "border-slate-900 ring-1 ring-slate-900"
                      : "border-slate-200",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-sm">{s.title}</div>
                    {severityBadge(s.severity)}
                  </div>
                  <div className="mt-2 text-xs text-slate-600 line-clamp-3">
                    {s.message}
                  </div>
                </button>
              ))}
            </div>

            {/* Selected details */}
            <div className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
              {!selected ? (
                <div className="text-sm text-slate-600">No issue selected.</div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{selected.title}</div>
                      <div className="text-xs text-slate-500">{selected.type}</div>
                    </div>
                    {severityBadge(selected.severity)}
                  </div>

                  <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                    {selected.message}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => applySuggestion(selected)}
                      disabled={!selected.replacement}
                      className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm disabled:opacity-50"
                    >
                      Apply correction
                    </button>
                    <button
                      onClick={() => ignoreSuggestion(selected)}
                      className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-sm"
                    >
                      Ignore
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
