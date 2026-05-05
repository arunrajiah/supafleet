// Minimal stub for next/server used in API route tests.
export class NextResponse {
  readonly status: number
  private body: unknown

  constructor(body: unknown, init?: { status?: number }) {
    this.body = body
    this.status = init?.status ?? 200
  }

  async json() {
    return this.body
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cookies = { set: jest.fn() } as any

  static json(data: unknown, init?: { status?: number }) {
    return new NextResponse(data, init)
  }
}

export class NextRequest {
  readonly url: string
  private _body: unknown

  constructor(url: string, init?: { body?: string }) {
    this.url = url
    this._body = init?.body ? JSON.parse(init.body) : {}
  }

  async json() {
    return this._body
  }
}
