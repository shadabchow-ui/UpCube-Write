import React, { useCallback, useEffect, useRef, useState } from "react"

type Match = {
  message: string
  shortMessage: string
  offset: number
  length: number
  replacements: { value: string }[]
  rule: {
    id: string
    description: string
    issueType: string
  }
}

interface Props {
  apiBase: string
}

export default function Editor({ apiBase }: Props) {
  const [text, setText] = useState("")
  const [matches, setMatches] = useState<Match[]>([])
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const checkText = useCallback(
    async (content: string) => {
      if (!content.trim()) {
        setMatches([])
        return
      }

      setChecking(true)
      setError(null)

      try {
        const body = new URLSearchParams({
          text: content,
          language: "en-US",
        })

        const res = await fetch(apiBase, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        })

        if (!res.ok) {
          throw new Error("Language engine error")
        }

        const data = await res.json()
        setMatches(data.matches || [])
      } catch (e) {
        setError("Could not connect to language engine")
        setMatches([])
      } finally {
        setChecking(false)
      }
    },
    [apiBase]
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      checkText(text)
    }, 700)

    return () => clearTimeout(timer)
  }, [text, checkText])

  const applyReplacement = (match: Match, replacement: string) => {
    const before = text.slice(0, match.offset)
    const after = text.slice(match.offset + match.length)

    const newText = before + replacement + after
    setText(newText)

    setMatches((prev) =>
      prev.filter((m) => m.offset !== match.offset || m.length !== match.length)
    )

    textareaRef.current?.focus()
  }

  const renderHighlightedText = () => {
    if (!matches.length) return text

    let lastIndex = 0
    const parts: React.ReactNode[] = []

    const sorted = [...matches].sort((a, b) => a.offset - b.offset)

    sorted.forEach((m, i) => {
      const before = text.slice(lastIndex, m.offset)
      const highlight = text.slice(m.offset, m.offset + m.length)

      parts.push(before)

      parts.push(
        <mark
          key={i}
          className="rounded bg-amber-200 px-0.5 hover:bg-amber-300 cursor-pointer"
          title={m.message}
        >
          {highlight}
        </mark>
      )

      lastIndex = m.offset + m.length
    })

    parts.push(text.slice(lastIndex))

    return parts
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* EDITOR PANEL */}
      <div className="lg:col-span-2 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-700">
            Your Writing
          </div>

          {checking && (
            <span className="text-xs text-slate-500">Checking…</span>
          )}
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            className="w-full min-h-[360px] resize-none rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-900 shadow-sm focus:border-indigo-400 focus:ring focus:ring-indigo-200 focus:ring-opacity-40 outline-none"
            placeholder="Start typing or paste your text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {text && (
            <div className="absolute top-3 right-3 text-xs text-slate-400">
              {text.length} characters
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!text && (
          <div className="text-center text-sm text-slate-400 py-8">
            Type something to receive suggestions
          </div>
        )}
      </div>

      {/* SUGGESTIONS PANEL */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-700">
            Suggestions
          </div>

          {matches.length > 0 && (
            <span className="text-xs text-slate-500">
              {matches.length} issue{matches.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {matches.length === 0 && text && !checking && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              No issues found. Nice writing 👍
            </div>
          )}

          {matches.map((m, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm text-slate-800">{m.message}</div>

                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-600">
                  {m.rule.issueType}
                </span>
              </div>

              {m.replacements.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.replacements.slice(0, 5).map((r, i) => (
                    <button
                      key={i}
                      onClick={() => applyReplacement(m, r.value)}
                      className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      {r.value}
                    </button>
                  ))}
                </div>
              )}

              {m.shortMessage && (
                <div className="mt-2 text-xs text-slate-500">
                  {m.shortMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
