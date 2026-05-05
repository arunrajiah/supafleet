import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { listTenants, createTenant } from '@/lib/tenant'

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenants = await listTenants()
  return NextResponse.json(tenants)
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, siteUrl } = await req.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const domain    = process.env.DOMAIN ?? 'localhost'
  const resolvedUrl = siteUrl || `http://${name}.${domain}`

  try {
    const config = await createTenant(name, resolvedUrl)
    return NextResponse.json(config, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Provisioning failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
