import React, { useEffect, useMemo, useRef, useState } from 'react';

type Status = 'online' | 'offline';

type SuggestionSeverity = 'critical' | 'warning' | 'info';

type Suggestion = {
  id: string;
  severity: SuggestionSeverity;
  title: string;
  detail: string;
  before?: string;
  after?: string;
  apply?: (text: string) => string;
};

type LTReplacement = { value: string };
type LTMatch = {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements: LTReplacement[];
  rule?: {
    id?: string;
    description?: string;
    issueType?: string; // e.g. "misspelling", "grammar", "style"
  };
  context?: {
    text?: string;
    offset?: number;
    length?: number;
  };
};

type LTCheckPayload = {
  ok: boolean;
  status?: number;
  error?: string;
  data?: {
    matches?: LTMatch[];
  } | null;
};

const SIDEBAR_ITEMS = [
  { key: 'docs', label: 'Docs' },
  { key: 'templates', label: 'Templates' },
  { key: 'tone', label: 'Tone & style' },
  { key: 'settings', label: 'Settings' },
] as const;

export default function App() {
  // Fake engine status (replace with your real backend healthcheck later)
  const [status, setStatus] = useState<Status>('offline');

  const [activeNav, setActiveNav] = useState<(typeof SIDEBAR_ITEMS)[number]['key']>('docs');
  const [docTitle, setDocTitle] = useState('Untitled doc');
  const [text, setText] = useState('');

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Real healthcheck against our server-side proxy.
    (async () => {
      try {
        const res = await fetch('/api/lt/health', { method: 'GET' });
        const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
        setStatus(json?.ok ? 'online' : 'offline');
      } catch {
        setStatus('offline');
      }
    })();
  }, []);

  // Debounced suggestion fetch. Falls back to local heuristics when offline.
  useEffect(() => {
    if (status !== 'online') {
      setSuggestions(buildSuggestions(text));
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }

    const t = window.setTimeout(async () => {
      setIsChecking(true);
      try {
        const res = await fetch('/api/lt/check', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: trimmed, language: 'auto' }),
        });
        const payload = (await res.json().catch(() => null)) as LTCheckPayload | null;

        if (!payload?.ok || !payload.data?.matches) {
          setSuggestions(buildSuggestions(text));
          return;
        }

        setSuggestions(mapLanguageToolMatchesToSuggestions(payload.data.matches, text));
      } catch {
        setSuggestions(buildSuggestions(text));
      } finally {
        setIsChecking(false);
      }
    }, 450);

    return () => window.clearTimeout(t);
  }, [text, status]);

  const counts = useMemo(() => {
    const c = suggestions.filter(s => s.severity === 'critical').length;
    const w = suggestions.filter(s => s.severity === 'warning').length;
    const i = suggestions.filter(s => s.severity === 'info').length;
    return { c, w, i, total: suggestions.length };
  }, [suggestions]);

  function applySuggestion(s: Suggestion) {
    if (!s.apply) return;
    const next = s.apply(text);
    setText(next);

    // Keep cursor usable
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  return (
    <div className="h-screen w-screen bg-app flex flex-col text-ink">
      <TopBar
        title={docTitle}
        onTitleChange={setDocTitle}
        status={status}
        counts={counts}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar active={activeNav} onChange={setActiveNav} />
        <MainShell>
          <EditorAndSuggestions
            status={status}
            text={text}
            setText={setText}
            textareaRef={textareaRef}
            suggestions={suggestions}
            isChecking={isChecking}
            onApply={applySuggestion}
          />
        </MainShell>
      </div>
    </div>
  );
}

/* ----------------------------- Layout Pieces ----------------------------- */

function TopBar({
  title,
  onTitleChange,
  status,
  counts,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  status: Status;
  counts: { c: number; w: number; i: number; total: number };
}) {
  return (
    <header className="h-12 bg-surface border-b border-line flex items-center px-4 md:px-6 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-7 w-7 rounded-md bg-neutral-100 border border-line" />
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="min-w-0 bg-transparent outline-none font-semibold text-sm md:text-[13.5px] text-ink px-2 py-1 rounded-md hover:bg-neutral-50 focus:bg-white focus:ring-2 focus:ring-focus"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <StatusPill status={status} />
        <MiniCounts counts={counts} />

        <button className="btn-ghost hidden sm:inline-flex">Docs</button>
        <button className="btn-primary hidden sm:inline-flex">Share</button>

        <div className="h-8 w-8 rounded-full bg-neutral-100 border border-line" />
      </div>
    </header>
  );
}

function StatusPill({ status }: { status: Status }) {
  const isOnline = status === 'online';
  return (
    <div className={`pill ${isOnline ? 'pill-online' : 'pill-offline'}`}>
      <span className={`dot ${isOnline ? 'dot-online' : 'dot-offline'}`} />
      <span className="text-[12px] font-medium">{isOnline ? 'online' : 'offline'}</span>
    </div>
  );
}

function MiniCounts({ counts }: { counts: { c: number; w: number; i: number; total: number } }) {
  if (counts.total === 0) return null;
  return (
    <div className="hidden md:flex items-center gap-2 px-2">
      {counts.c > 0 && <Badge tone="critical">{counts.c} critical</Badge>}
      {counts.w > 0 && <Badge tone="warning">{counts.w} warnings</Badge>}
      {counts.i > 0 && <Badge tone="info">{counts.i} tips</Badge>}
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: 'critical' | 'warning' | 'info';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'critical'
      ? 'bg-red-50 text-red-700 border-red-200'
      : tone === 'warning'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-blue-50 text-blue-700 border-blue-200';

  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[12px] ${cls}`}>{children}</span>;
}

function Sidebar({
  active,
  onChange,
}: {
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <aside className="w-60 bg-surface border-r border-line px-3 py-5 hidden md:flex flex-col">
      <div className="px-2 pb-4">
        <div className="text-[12px] text-muted font-medium">Docs</div>
      </div>

      <nav className="space-y-1">
        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={[
              'w-full text-left px-3 py-2 rounded-md text-[13px] transition',
              item.key === active
                ? 'bg-neutral-100 text-ink font-medium border border-line'
                : 'text-muted hover:bg-neutral-50 hover:text-ink',
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 px-2">
        <div className="text-[11px] text-muted">Powered by UpCube Language Engine</div>
      </div>
    </aside>
  );
}

function MainShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full overflow-hidden">{children}</div>
    </div>
  );
}

/* ----------------------------- Editor + Suggestions ----------------------------- */

function EditorAndSuggestions({
  status,
  text,
  setText,
  textareaRef,
  suggestions,
  isChecking,
  onApply,
}: {
  status: Status;
  text: string;
  setText: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  suggestions: Suggestion[];
  isChecking: boolean;
  onApply: (s: Suggestion) => void;
}) {
  const [filter, setFilter] = useState<'all' | SuggestionSeverity>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return suggestions;
    return suggestions.filter((s) => s.severity === filter);
  }, [filter, suggestions]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Editor column */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-6 lg:py-8">
        <div className="mx-auto max-w-editor">
          {/* Header line */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[13px] font-semibold">Your writing</div>
              <div className="text-[12px] text-muted">Write, refine, and apply suggestions.</div>
            </div>

            {/* Mobile status pill */}
            <div className="md:hidden">
              <StatusPill status={status} />
            </div>
          </div>

          {/* Editor card */}
          <div className="card p-5 sm:p-6">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Start typing or paste your text here..."
              className="w-full min-h-[340px] resize-none outline-none bg-transparent text-[15px] leading-relaxed placeholder:text-neutral-400"
            />
          </div>

          {/* Footer helper */}
          <div className="mt-3 text-[12px] text-muted">
            Tip: paste a paragraph to see structured suggestions.
          </div>

          {/* Offline banner like your screenshot */}
          {status === 'offline' && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              Your language engine is offline. The editor still works, but suggestions may be limited until the backend is reachable.
            </div>
          )}
        </div>
      </main>

      {/* Suggestions column */}
      <aside className="w-80 lg:w-96 border-l border-line bg-surface hidden sm:flex flex-col">
        <div className="px-4 py-4 border-b border-line">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold">Suggestions</div>
              <div className="text-[12px] text-muted">Clear, actionable edits.</div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="text-[12px] bg-white border border-line rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-focus"
              >
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="warning">Warnings</option>
                <option value="info">Tips</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {filtered.length === 0 ? (
            isChecking ? (
              <div className="text-[12.5px] text-muted">Checking…</div>
            ) : (
              <EmptySuggestions />
            )
          ) : (
            <div className="space-y-3">
              {filtered.map((s) => (
                <SuggestionCard key={s.id} s={s} onApply={() => onApply(s)} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function mapLanguageToolMatchesToSuggestions(matches: LTMatch[], fullText: string): Suggestion[] {
  // Keep stable ordering: earliest match first.
  const sorted = [...matches].sort((a, b) => a.offset - b.offset);

  return sorted.map((m, idx) => {
    const id = `${m.rule?.id || 'match'}-${m.offset}-${m.length}-${idx}`;
    const issueType = (m.rule?.issueType || '').toLowerCase();

    const severity: SuggestionSeverity =
      issueType === 'misspelling' || issueType === 'grammar'
        ? 'critical'
        : issueType === 'style'
        ? 'warning'
        : 'info';

    const title = m.shortMessage || m.rule?.description || m.rule?.id || 'Suggestion';
    const detail = m.message || 'Possible improvement.';

    const before = fullText.slice(m.offset, m.offset + m.length);
    const bestReplacement = m.replacements?.[0]?.value;
    const after = bestReplacement || undefined;

    const apply = bestReplacement
      ? (current: string) => current.slice(0, m.offset) + bestReplacement + current.slice(m.offset + m.length)
      : undefined;

    return { id, severity, title, detail, before, after, apply };
  });
}

/* ----------------------------- Suggestion Cards ----------------------------- */

function SuggestionCard({ s, onApply }: { s: Suggestion; onApply: () => void }) {
  const severityLabel =
    s.severity === 'critical' ? 'Critical' : s.severity === 'warning' ? 'Warning' : 'Tip';

  const toneCls =
    s.severity === 'critical'
      ? 'border-red-200 bg-red-50 text-red-700'
      : s.severity === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-blue-200 bg-blue-50 text-blue-700';

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${toneCls}`}>
              {severityLabel}
            </span>
            <span className="text-[13px] font-semibold text-ink truncate">{s.title}</span>
          </div>
          <div className="text-[12.5px] text-muted leading-snug">{s.detail}</div>
        </div>
      </div>

      {(s.before || s.after) && (
        <div className="mt-3 rounded-md border border-line bg-white p-3 text-[12px]">
          {s.before && (
            <div className="mb-2">
              <div className="text-[11px] text-muted mb-1">Before</div>
              <div className="text-ink">{s.before}</div>
            </div>
          )}
          {s.after && (
            <div>
              <div className="text-[11px] text-muted mb-1">After</div>
              <div className="text-ink">{s.after}</div>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button className="btn-ghost">Dismiss</button>
        <button
          className={`btn ${
            s.severity === 'critical'
              ? 'btn-danger'
              : s.severity === 'warning'
              ? 'btn-warn'
              : 'btn-primary'
          }`}
          onClick={onApply}
          disabled={!s.apply}
          title={!s.apply ? 'No automatic apply available' : 'Apply this change'}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function EmptySuggestions() {
  return (
    <div className="pt-6">
      <div className="text-[13px] font-semibold text-ink mb-1">Nothing to show yet</div>
      <div className="text-[12.5px] text-muted mb-4">
        Add a paragraph to get clarity, tone, and grammar suggestions.
      </div>

      <div className="space-y-3">
        <div className="card p-4">
          <div className="text-[12px] text-muted mb-2">Try pasting something like:</div>
          <div className="text-[12.5px] text-ink leading-snug">
            “I want to build a clean writing assistant interface that feels calm and focused.”
          </div>
        </div>

        <div className="card p-4">
          <div className="text-[12px] text-muted mb-2">Or test a rough draft:</div>
          <div className="text-[12.5px] text-ink leading-snug">
            “im trying to make this better but my wording is not good and its confusing.”
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Simple “AI” Suggestion Engine ----------------------------- */
/**
 * This is intentionally lightweight and deterministic.
 * Replace later with your real backend.
 */
function buildSuggestions(text: string): Suggestion[] {
  const t = text ?? '';
  const out: Suggestion[] = [];

  const hasText = t.trim().length > 0;
  if (!hasText) return out;

  // 1) Common quick wins: capitalization of "i"
  if (/\bi\b/.test(t)) {
    out.push({
      id: 'cap-i',
      severity: 'warning',
      title: 'Capitalize “I”',
      detail: 'Capitalizing the first-person pronoun improves professionalism and readability.',
      before: 'i am working on this...',
      after: 'I am working on this...',
      apply: (s) => s.replace(/\bi\b/g, 'I'),
    });
  }

  // 2) Double spaces
  if (/ {2,}/.test(t)) {
    out.push({
      id: 'double-space',
      severity: 'info',
      title: 'Remove extra spaces',
      detail: 'Extra spaces can make your writing feel uneven.',
      before: 'This  has  extra spaces.',
      after: 'This has extra spaces.',
      apply: (s) => s.replace(/ {2,}/g, ' '),
    });
  }

  // 3) Very long sentence heuristic
  const longSent = t.split(/[.!?]\s/).find((s) => s.trim().split(/\s+/).length > 30);
  if (longSent) {
    out.push({
      id: 'long-sentence',
      severity: 'warning',
      title: 'Consider splitting a long sentence',
      detail: 'Long sentences can be harder to follow. Split it into two clear thoughts.',
      before: truncate(longSent.trim(), 110),
      after: 'Split into two shorter sentences for clarity.',
    });
  }

  // 4) Weak opener heuristic
  if (/^(so|okay|ok|well)\b/i.test(t.trim())) {
    out.push({
      id: 'opener',
      severity: 'info',
      title: 'Strengthen your opening line',
      detail: 'Starting with a direct statement sets a confident tone.',
      before: truncate(t.trim(), 80),
      after: 'Try opening with the core point you want to convey.',
    });
  }

  // 5) “im” -> “I’m”
  if (/\bim\b/i.test(t)) {
    out.push({
      id: 'im-contraction',
      severity: 'critical',
      title: 'Fix contraction “I’m”',
      detail: 'Correct contractions improve clarity and reduce friction for readers.',
      before: 'im working on it',
      after: 'I’m working on it',
      apply: (s) => s.replace(/\bim\b/gi, "I'm"),
    });
  }

  // 6) Too many exclamation marks
  if (/!{2,}/.test(t)) {
    out.push({
      id: 'exclaim',
      severity: 'warning',
      title: 'Reduce repeated exclamation marks',
      detail: 'A single exclamation mark is usually enough.',
      before: 'This is amazing!!!',
      after: 'This is amazing!',
      apply: (s) => s.replace(/!{2,}/g, '!'),
    });
  }

  return out.slice(0, 10);
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
