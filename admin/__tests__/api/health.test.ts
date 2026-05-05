import { GET } from '../../src/app/api/health/route'

describe('GET /api/health', () => {
  it('returns HTTP 200', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('returns { ok: true }', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })
})
