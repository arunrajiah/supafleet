'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Service = 'auth' | 'rest' | 'storage'
type Action  = 'restart' | `restart-${Service}` | 'upgrade'

interface Props {
  tenantName: string
  /** Whether any container is currently not running — used to highlight the Restart button. */
  hasUnhealthy: boolean
}

interface ButtonState {
  loading: boolean
  ok: boolean | null   // null = idle, true = success, false = error
  message: string
}

const IDLE: ButtonState = { loading: false, ok: null, message: '' }

const SERVICE_LABELS: Record<Service, string> = {
  auth:    'Auth',
  rest:    'REST',
  storage: 'Storage',
}

export default function ContainerActions({ tenantName, hasUnhealthy }: Props) {
  const router = useRouter()
  const [states, setStates] = useState<Record<Action, ButtonState>>({
    restart:          IDLE,
    'restart-auth':    IDLE,
    'restart-rest':    IDLE,
    'restart-storage': IDLE,
    upgrade:          IDLE,
  })

  async function invoke(action: Action) {
    setStates(s => ({ ...s, [action]: { loading: true, ok: null, message: '' } }))

    let body: Record<string, string>
    if (action === 'restart' || action === 'upgrade') {
      body = { action }
    } else {
      const service = action.replace('restart-', '') as Service
      body = { action: 'restart-service', service }
    }

    try {
      const res  = await fetch(`/api/tenants/${tenantName}/containers`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setStates(s => ({ ...s, [action]: { loading: false, ok: true, message: 'Done' } }))
      // Refresh server-side data (container status) after 800 ms to let
      // Docker settle before Next.js re-renders the page.
      setTimeout(() => router.refresh(), 800)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setStates(s => ({ ...s, [action]: { loading: false, ok: false, message: msg } }))
    }

    // Auto-clear feedback after 4 s
    setTimeout(() => setStates(s => ({ ...s, [action]: IDLE })), 4000)
  }

  function ActionButton({
    action,
    label,
    variant = 'secondary',
  }: {
    action:  Action
    label:   string
    variant?: 'primary' | 'secondary' | 'warning'
  }) {
    const st = states[action]
    const base = 'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed'
    const colours = {
      primary:   'bg-brand text-black hover:bg-brand/90',
      secondary: 'bg-gray-800 text-gray-200 hover:bg-gray-700',
      warning:   'bg-amber-900/40 text-amber-300 hover:bg-amber-900/60 border border-amber-800/50',
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => invoke(action)}
          disabled={st.loading || Object.values(states).some(s => s.loading)}
          className={`${base} ${colours[variant]}`}
        >
          {st.loading ? (
            <>
              <Spinner />
              <span>Running…</span>
            </>
          ) : (
            label
          )}
        </button>
        {st.ok === true  && <span className="text-xs text-green-400">✓ {st.message}</span>}
        {st.ok === false && <span className="text-xs text-red-400">✗ {st.message}</span>}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Restart all ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Restart all services</p>
        <ActionButton
          action="restart"
          label={hasUnhealthy ? '⟳ Restart all (recommended)' : '⟳ Restart all'}
          variant={hasUnhealthy ? 'warning' : 'secondary'}
        />
      </div>

      {/* ── Per-service restart ──────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Restart individual service</p>
        <div className="flex flex-wrap gap-2">
          {(['auth', 'rest', 'storage'] as Service[]).map(svc => (
            <ActionButton
              key={svc}
              action={`restart-${svc}`}
              label={`⟳ ${SERVICE_LABELS[svc]}`}
              variant="secondary"
            />
          ))}
        </div>
      </div>

      {/* ── Upgrade ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Upgrade to latest versions</p>
        <p className="text-xs text-gray-600 mb-2">
          Pulls the image tags defined in <code className="bg-gray-800 px-1 rounded">versions.json</code>,
          then recreates each container. Data is preserved — the database and storage volume are not touched.
        </p>
        <ActionButton
          action="upgrade"
          label="↑ Upgrade services"
          variant="primary"
        />
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
