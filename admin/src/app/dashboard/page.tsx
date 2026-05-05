import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated } from '@/lib/auth'
import { listTenants } from '@/lib/tenant'
import Shell from '@/components/Shell'
import StatusDot from '@/components/StatusDot'
import type { ContainerStatus } from '@/lib/docker'

function allRunning(containers: ContainerStatus[]) {
  return containers.every((c) => c.status === 'running')
}

function overallStatus(containers: ContainerStatus[]): 'running' | 'stopped' | 'error' | 'missing' {
  if (containers.every((c) => c.status === 'running')) return 'running'
  if (containers.some((c) => c.status === 'error'))   return 'error'
  if (containers.some((c) => c.status === 'missing'))  return 'missing'
  return 'stopped'
}

export default async function DashboardPage() {
  if (!(await isAuthenticated())) redirect('/login')

  const tenants = await listTenants()
  const domain  = process.env.DOMAIN ?? 'localhost'

  return (
    <Shell>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Databases</h1>
          <p className="text-sm text-gray-400 mt-1">
            {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} on <span className="text-gray-300">{domain}</span>
          </p>
        </div>
        <Link
          href="/tenants/new"
          className="bg-brand hover:bg-brand-dark text-gray-950 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + New database
        </Link>
      </div>

      {tenants.length === 0 ? (
        <div className="border border-dashed border-gray-700 rounded-xl p-12 text-center">
          <p className="text-gray-400 mb-4">No databases yet.</p>
          <Link
            href="/tenants/new"
            className="text-brand hover:underline text-sm"
          >
            Create your first database →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {tenants.map((t) => (
            <Link
              key={t.name}
              href={`/tenants/${t.name}`}
              className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-white group-hover:text-brand transition-colors">
                      {t.name}
                    </h2>
                    <StatusDot status={overallStatus(t.containers)} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{t.siteUrl}</p>
                  <p className="text-xs text-gray-600 mt-0.5">DB: {t.dbName}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0 ml-4">
                  {t.containers.map((c) => (
                    <div key={c.name} className="text-center">
                      <p className="text-xs text-gray-500 mb-1">{c.name}</p>
                      <StatusDot status={c.status} />
                    </div>
                  ))}
                  <span className="text-gray-600 group-hover:text-gray-400 text-lg transition-colors ml-2">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  )
}
