import { tenantDbName } from '../../src/lib/tenant'

// tenant.ts imports docker/db/nginx modules — stub them out so the module
// can be loaded without Docker or Postgres available
jest.mock('../../src/lib/docker',  () => ({}))
jest.mock('../../src/lib/db',      () => ({}))
jest.mock('../../src/lib/nginx',   () => ({}))
jest.mock('../../src/lib/jwt-gen', () => ({}))

// ── tenantDbName ──────────────────────────────────────────────────────────────

describe('tenantDbName', () => {
  it('prefixes the name with "tenant_"', () => {
    expect(tenantDbName('myapp')).toBe('tenant_myapp')
  })

  it('replaces hyphens with underscores', () => {
    expect(tenantDbName('my-app')).toBe('tenant_my_app')
    expect(tenantDbName('a-b-c')).toBe('tenant_a_b_c')
  })

  it('handles names with trailing digits', () => {
    expect(tenantDbName('project123')).toBe('tenant_project123')
  })

  it('handles names with mixed hyphens and digits', () => {
    expect(tenantDbName('client-2')).toBe('tenant_client_2')
  })

  it('handles a name with multiple consecutive hyphens', () => {
    expect(tenantDbName('a--b')).toBe('tenant_a__b')
  })
})
