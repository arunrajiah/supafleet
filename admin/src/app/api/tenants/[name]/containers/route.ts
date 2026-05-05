import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { readTenantConfig, restartTenantContainers, restartSingleTenantContainer, upgradeTenant } from '@/lib/tenant'

type Params = { params: Promise<{ name: string }> }

const VALID_SERVICES = ['auth', 'rest', 'storage'] as const
type Service = (typeof VALID_SERVICES)[number]

/**
 * POST /api/tenants/:name/containers
 *
 * Body:
 *   { "action": "restart" }                          — restart all three containers
 *   { "action": "restart-service", "service": "..." } — restart one (auth | rest | storage)
 *   { "action": "upgrade" }                          — pull latest images + recreate containers
 *
 * All actions are idempotent-safe: a missing container is silently skipped for
 * restart, and upgrade always pulls before removing so there is no window
 * where the tenant is down without a valid image.
 */
export async function POST(req: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name } = await params

  if (!readTenantConfig(name)) {
    return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 })
  }

  let body: { action?: string; service?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { action, service } = body

  switch (action) {
    case 'restart': {
      await restartTenantContainers(name)
      return NextResponse.json({ ok: true, action: 'restart' })
    }

    case 'restart-service': {
      if (!service || !VALID_SERVICES.includes(service as Service)) {
        return NextResponse.json(
          { error: `service must be one of: ${VALID_SERVICES.join(', ')}` },
          { status: 400 },
        )
      }
      await restartSingleTenantContainer(name, service as Service)
      return NextResponse.json({ ok: true, action: 'restart-service', service })
    }

    case 'upgrade': {
      await upgradeTenant(name)
      return NextResponse.json({ ok: true, action: 'upgrade' })
    }

    default:
      return NextResponse.json(
        { error: 'action must be one of: restart, restart-service, upgrade' },
        { status: 400 },
      )
  }
}
