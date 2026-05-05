import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated } from '@/lib/auth'
import { readTenantConfig } from '@/lib/tenant'
import { getTenantStatus } from '@/lib/docker'
import Shell from '@/components/Shell'
import StatusDot from '@/components/StatusDot'
import CopyButton from '@/components/CopyButton'
import DeleteTenantButton from './DeleteTenantButton'
import ContainerActions from './ContainerActions'

type Props = { params: Promise<{ name: string }> }

function KeyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-3 bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5">
        <span className={`${mono ? 'font-mono' : ''} text-xs text-gray-300 flex-1 truncate`}>{value}</span>
        <CopyButton text={value} />
      </div>
    </div>
  )
}

export default async function TenantPage({ params }: Props) {
  if (!(await isAuthenticated())) redirect('/login')

  const { name } = await params
  const cfg = readTenantConfig(name)
  if (!cfg) notFound()

  const containers = await getTenantStatus(name)

  return (
    <Shell>
      <div className="max-w-3xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-gray-500 hover:text-white transition-colors text-sm">
            ← Databases
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-sm text-gray-300 font-mono">{cfg.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white font-mono">{cfg.name}</h1>
            <a
              href={cfg.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-gray-400 hover:text-brand transition-colors mt-1 inline-block"
            >
              {cfg.siteUrl} ↗
            </a>
          </div>
        </div>

        {/* Container status + actions */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Services</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {containers.map((c) => (
              <div key={c.name} className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-center">
                <p className="text-xs text-gray-400 mb-2 capitalize">{c.name}</p>
                <StatusDot status={c.status} />
                {c.health && (
                  <p className="text-xs text-gray-600 mt-1">{c.health}</p>
                )}
                {c.image && (
                  <p className="text-xs text-gray-700 mt-1 font-mono truncate" title={c.image}>
                    {c.image.split(':')[1] ?? c.image}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-5">
            <h3 className="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wide">Actions</h3>
            <ContainerActions
              tenantName={cfg.name}
              hasUnhealthy={containers.some(c => c.status !== 'running')}
            />
          </div>
        </section>

        {/* API endpoints */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300">API endpoints</h2>
          <KeyRow label="REST"    value={`${cfg.siteUrl}/rest/v1/`}    mono={false} />
          <KeyRow label="Auth"    value={`${cfg.siteUrl}/auth/v1/`}    mono={false} />
          <KeyRow label="Storage" value={`${cfg.siteUrl}/storage/v1/`} mono={false} />
          <KeyRow label="GraphQL" value={`${cfg.siteUrl}/graphql/v1`}  mono={false} />
        </section>

        {/* Credentials */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">Credentials</h2>
            <p className="text-xs text-gray-500">Keep the service role key secret</p>
          </div>
          <KeyRow label="Anon key (public)"         value={cfg.anonKey} />
          <KeyRow label="Service role key (secret)" value={cfg.serviceRoleKey} />
          <KeyRow label="JWT secret"                value={cfg.jwtSecret} />
          <KeyRow label="Database name"             value={cfg.dbName} />
          <KeyRow label="S3 access key"             value={cfg.s3Key} />
          <KeyRow label="S3 secret"                 value={cfg.s3Secret} />
        </section>

        {/* Client snippet */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Quick start</h2>
          <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
{`import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  '${cfg.siteUrl}',
  '${cfg.anonKey}'
)`}
          </pre>
          <CopyButton text={`import { createClient } from '@supabase/supabase-js'\n\nconst supabase = createClient(\n  '${cfg.siteUrl}',\n  '${cfg.anonKey}'\n)`} />
        </section>

        {/* Meta */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-4">
              <dt className="text-gray-500 w-28 shrink-0">Created</dt>
              <dd className="text-gray-300">{new Date(cfg.createdAt).toLocaleString()}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="text-gray-500 w-28 shrink-0">Database</dt>
              <dd className="text-gray-300 font-mono">{cfg.dbName}</dd>
            </div>
          </dl>
        </section>

        {/* Danger zone */}
        <section className="bg-gray-900 border border-red-900/50 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-red-400 mb-1">Danger zone</h2>
          <p className="text-xs text-gray-500 mb-4">
            Deleting stops all services. Checking "also delete database" permanently removes all data.
          </p>
          <DeleteTenantButton name={cfg.name} />
        </section>
      </div>
    </Shell>
  )
}
