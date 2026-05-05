import path from 'path'

// Mock fs before importing the module under test
jest.mock('fs')
import fs from 'fs'

import { writeTenantNginxConf, removeTenantNginxConf } from '../../src/lib/nginx'

const mockFs      = fs as jest.Mocked<typeof fs>
const PROJECT_DIR = '/project'
const CONF_DIR    = path.join(PROJECT_DIR, 'nginx', 'conf.d')

beforeEach(() => {
  process.env.PROJECT_DIR = PROJECT_DIR
  jest.resetAllMocks()
  mockFs.mkdirSync.mockReturnValue(undefined)
  mockFs.writeFileSync.mockReturnValue(undefined)
  mockFs.existsSync.mockReturnValue(true)
  mockFs.unlinkSync.mockReturnValue(undefined)
})

// ── writeTenantNginxConf ─────────────────────────────────────────────────────

describe('writeTenantNginxConf', () => {
  it('creates the conf.d directory', () => {
    writeTenantNginxConf('myapp', 'example.com')
    expect(mockFs.mkdirSync).toHaveBeenCalledWith(CONF_DIR, { recursive: true })
  })

  it('writes to the correct file path', () => {
    writeTenantNginxConf('myapp', 'example.com')
    const [filePath] = (mockFs.writeFileSync as jest.Mock).mock.calls[0] as [string, string]
    expect(filePath).toBe(path.join(CONF_DIR, 'myapp.conf'))
  })

  it('sets server_name to <name>.<domain>', () => {
    writeTenantNginxConf('myapp', 'example.com')
    const [, content] = (mockFs.writeFileSync as jest.Mock).mock.calls[0] as [string, string]
    expect(content).toContain('server_name myapp.example.com')
  })

  it('proxies /rest/v1/ to rest-<name>:3000', () => {
    writeTenantNginxConf('myapp', 'example.com')
    const [, content] = (mockFs.writeFileSync as jest.Mock).mock.calls[0] as [string, string]
    expect(content).toContain('http://rest-myapp:3000')
    expect(content).toContain('location /rest/v1/')
  })

  it('proxies /auth/v1/ to auth-<name>:9999', () => {
    writeTenantNginxConf('myapp', 'example.com')
    const [, content] = (mockFs.writeFileSync as jest.Mock).mock.calls[0] as [string, string]
    expect(content).toContain('http://auth-myapp:9999')
    expect(content).toContain('location /auth/v1/')
  })

  it('proxies /storage/v1/ to storage-<name>:5000', () => {
    writeTenantNginxConf('myapp', 'example.com')
    const [, content] = (mockFs.writeFileSync as jest.Mock).mock.calls[0] as [string, string]
    expect(content).toContain('http://storage-myapp:5000')
    expect(content).toContain('location /storage/v1/')
  })

  it('proxies /graphql/v1 to rest-<name>:3000/rpc/graphql', () => {
    writeTenantNginxConf('myapp', 'example.com')
    const [, content] = (mockFs.writeFileSync as jest.Mock).mock.calls[0] as [string, string]
    expect(content).toContain('/rpc/graphql')
    expect(content).toContain('location /graphql/v1')
  })

  it('uses a different tenant name correctly', () => {
    writeTenantNginxConf('client-two', 'acme.io')
    const [filePath, content] = (mockFs.writeFileSync as jest.Mock).mock.calls[0] as [string, string]
    expect(filePath).toBe(path.join(CONF_DIR, 'client-two.conf'))
    expect(content).toContain('server_name client-two.acme.io')
    expect(content).toContain('http://rest-client-two:3000')
  })
})

// ── removeTenantNginxConf ─────────────────────────────────────────────────────

describe('removeTenantNginxConf', () => {
  it('deletes the tenant conf file when it exists', () => {
    mockFs.existsSync.mockReturnValue(true)
    removeTenantNginxConf('myapp')
    expect(mockFs.unlinkSync).toHaveBeenCalledWith(path.join(CONF_DIR, 'myapp.conf'))
  })

  it('does nothing when the file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false)
    removeTenantNginxConf('myapp')
    expect(mockFs.unlinkSync).not.toHaveBeenCalled()
  })
})
