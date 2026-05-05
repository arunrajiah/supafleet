// Stub for next/headers — not available outside the Next.js runtime.
const cookieStore = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
}
export const cookies = jest.fn().mockResolvedValue(cookieStore)
export const headers = jest.fn().mockResolvedValue(new Map())
