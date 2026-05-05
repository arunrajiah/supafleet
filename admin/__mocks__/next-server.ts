// Minimal stub for next/server used in API route tests.

export class NextResponse {
  readonly status: number
  private body: unknown
  readonly headers: Map<string, string>

  constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body
    this.status = init?.status ?? 200
    this.headers = new Map(Object.entries(init?.headers ?? {}))
  }

  async json() {
    return this.body
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cookies = { set: jest.fn() } as any

  static json(
    data: unknown,
    init?: { status?: number; headers?: Record<string, string> },
  ) {
    return new NextResponse(data, init)
  }
}

export class NextRequest {
  readonly url: string
  readonly headers: Map<string, string>
  private _body: unknown

  constructor(
    url: string,
    init?: { body?: string; headers?: Record<string, string>; method?: string },
  ) {
    this.url = url
    this._body = init?.body ? JSON.parse(init.body) : {}
    this.headers = new Map(
      Object.entries(init?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    )
  }

  async json() {
    return this._body
  }
}
