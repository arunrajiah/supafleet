'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/components/Shell'
import CopyButton from '@/components/CopyButton'

interface CreatedTenant {
  name:           string
  siteUrl:        string
  anonKey:        string
  serviceRoleKey: string
  dbName:         string
}

export default function NewTenantPage() {
  const router = useRouter()

  const [name, setName]       = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<CreatedTenant | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/tenants', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, siteUrl: siteUrl || undefined }),
    })

    setLoading(false)

    if (res.ok) {
      const data = await res.json()
      setCreated(data)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Provisioning failed.')
    }
  }

  if (created) {
    return (
      <Shell>
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center">
              <span className="text-brand text-lg">✓</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Database ready</h1>
              <p className="text-sm text-gray-400">{created.siteUrl}</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
            <p className="text-sm text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-4 py-3">
              Copy your keys now — the JWT secret won&apos;t be shown again on this screen.
            </p>

            {[
              { label: 'Anon key (public)',        value: created.anonKey },
              { label: 'Service role key (secret)', value: created.serviceRoleKey },
              { label: 'REST API',                 value: `${created.siteUrl}/rest/v1/` },
              { label: 'Auth API',                 value: `${created.siteUrl}/auth/v1/` },
              { label: 'Storage API',              value: `${created.siteUrl}/storage/v1/` },
              { label: 'Database name',            value: created.dbName },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-500 mb-1.5">{label}</p>
                <div className="flex items-center gap-3 bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5">
                  <code className="text-xs text-gray-300 flex-1 truncate">{value}</code>
                  <CopyButton text={value} />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <Link
              href="/dashboard"
              className="bg-brand hover:bg-brand-dark text-gray-950 font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
            >
              Go to dashboard
            </Link>
            <Link
              href={`/tenants/${created.name}`}
              className="text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 px-5 py-2.5 rounded-lg transition-colors"
            >
              View tenant
            </Link>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="max-w-xl">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-gray-500 hover:text-white transition-colors text-sm">
            ← Databases
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-sm text-gray-300">New database</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Create database</h1>
        <p className="text-sm text-gray-400 mb-8">
          Each database gets its own isolated PostgreSQL DB, Auth, REST API, and Storage.
        </p>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-6">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              Database name <span className="text-gray-500 text-xs">(e.g. myapp, client-acme)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="my-app"
              required
              pattern="[a-z][a-z0-9\-]{2,29}"
              title="3–30 chars, lowercase letters, digits, hyphens. Must start with a letter."
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand font-mono"
            />
            <p className="text-xs text-gray-600 mt-1.5">
              Accessible at <span className="text-gray-400">{name || '<name>'}.{typeof window !== 'undefined' ? window.location.hostname.split('.').slice(1).join('.') || 'yourdomain.com' : 'yourdomain.com'}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">
              Site URL <span className="text-gray-500 text-xs">(optional — auto-generated from domain)</span>
            </label>
            <input
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://myapp.example.com"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || name.length < 3}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-gray-950 font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Provisioning (this may take ~30s)…
              </span>
            ) : 'Create database →'}
          </button>
        </form>
      </div>
    </Shell>
  )
}
