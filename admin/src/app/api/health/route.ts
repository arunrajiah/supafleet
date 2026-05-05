import { NextResponse } from 'next/server'

// Simple liveness probe used by the Docker healthcheck.
// Returns 200 as soon as the Next.js server is accepting requests.
export async function GET() {
  return NextResponse.json({ ok: true })
}
