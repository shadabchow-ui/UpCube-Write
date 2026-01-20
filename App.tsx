import React, { useEffect, useMemo, useState } from 'react'
import Editor from './Editor'

const API_BASE = import.meta.env.VITE_LT_API || '/check'

type ApiStatus = 'checking' | 'ok' | 'down'

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')
  const [apiMessage, setApiMessage] = useState<string>('Checking language engine…')

  useEffect(() => {
    let cancelled = false

    async function ping() {
      try {
        // If your backend exposes a /health endpoint, use it.
        // Otherwise we do a lightweight POST to /check with tiny text.
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            language: 'en-US',
            text: 'hello',
          }).toString(),
        })

        if (!cancelled) {
          if (res.ok) {
            setApiStatus('ok')
            setApiMessage('Language engine online')
          } else {
            setApiStatus('down')
            setApiMessage('Language engine responded but looks unhealthy')
          }
        }
      } catch {
        if (!cancelled) {
          setApiStatus('down')
          setApiMessage('Cannot reach language engine')
        }
      }
    }

    ping()
    const id = window.setInterval(ping, 15000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const statusPill = useMemo(() => {
    if (apiStatus === 'checking') {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
          checking
        </span>
      )
    }
    if (apiStatus === 'ok') {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          online
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        offline
      </span>
    )
  }, [apiStatus])

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        {/* Left nav (Grammarly-ish) */}
        <aside className="hidden w-[280px] shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="flex h-full flex-col">
            <div className="px-5 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">UpCube Writer</div>
                  <div className="text-xs text-slate-500">Smart writing assistant</div>
                </div>
                {statusPill}
              </div>

              <div className="mt-3 text-xs text-slate-500">{apiMessage}</div>
            </div>

            <div className="px-3">
              <nav className="space-y-1">
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50">
                  Docs
                </button>
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50">
                  Templates
                </button>
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50">
                  Tone & Style
                </button>
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50">
                  Settings
                </button>
              </nav>
            </div>

            <div className="mt-auto border-t border-slate-200 px-5 py-4 text-xs text-slate-500">
              Powered by UpCube Language Engine
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3 md:px-6">
              <div className="flex items-center gap-3">
                <div className="lg:hidden">
                  <div className="text-sm font-semibold text-slate-900">UpCube Writer</div>
                  <div className="text-xs text-slate-500">Smart writing assistant</div>
                </div>
                <div className="hidden lg:block text-sm text-slate-500">Write, refine, and apply suggestions.</div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden sm:block">{statusPill}</div>
                <a
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  href="https://docs.upcube.ai"
                  target="_blank"
                  rel="noreferrer"
                >
                  Docs
                </a>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 px-4 py-6 md:px-6">
            <div className="mx-auto max-w-[1100px]">
              <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200 md:p-6">
                <Editor apiBase={API_BASE} />
              </div>

              {apiStatus === 'down' && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  Your language engine is offline. The editor still works, but suggestions may fail until the backend is
                  reachable.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
