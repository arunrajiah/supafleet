import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { readTenantConfig, deleteTenant } from '@/lib/tenant'
import { getTenantStatus } from '@/lib/docker'

type Params = { params: Promise<{ name: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name } = await params
  const cfg = readTenantConfig(name)
  if (!cfg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const containers = await getTenantStatus(name)
  return NextResponse.json({ ...cfg, containers })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name } = await params
  const { dropDb = false } = await req.json().catch(() => ({}))
  await deleteTenant(name, dropDb)
  return NextResponse.json({ ok: true })
}
