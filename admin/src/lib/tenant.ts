import fs from 'fs'
import path from 'path'
import { generateJWT, generateSecret } from './jwt-gen'
import { createTenantDatabase, dropTenantDatabase, initTenantDatabase, databaseExists } from './db'
import { startTenantContainers, stopTenantContainers, getTenantStatus, resolveHostPath, reloadNginx, restartTenantContainers, restartSingleTenantContainer, pullLatestImages, ContainerStatus } from './docker'

export { restartTenantContainers, restartSingleTenantContainer }
import { writeTenantNginxConf, removeTenantNginxConf } from './nginx'

const PROJECT_DIR  = process.env.PROJECT_DIR  ?? '/project'
const TENANTS_DIR  = path.join(PROJECT_DIR, 'tenants')
const STORAGE_DIR  = path.join(PROJECT_DIR, 'volumes', 'storage')

export interface TenantConfig {
  name:            string
  dbName:          string
  siteUrl:         string
  jwtSecret:       string
  anonKey:         string
  serviceRoleKey:  string
  s3Key:           string
  s3Secret:        string
  createdAt:       string
}

export interface TenantSummary extends TenantConfig {
  containers: ContainerStatus[]
}

export function tenantDbName(name: string): string {
  return `tenant_${name.replace(/-/g, '_')}`
}

function tenantDir(name: string) {
  return path.join(TENANTS_DIR, name)
}

function configPath(name: string) {
  return path.join(tenantDir(name), 'config.json')
}

export function readTenantConfig(name: string): TenantConfig | null {
  try {
    return JSON.parse(fs.readFileSync(configPath(name), 'utf8')) as TenantConfig
  } catch {
    return null
  }
}

export function listTenantNames(): string[] {
  if (!fs.existsSync(TENANTS_DIR)) return []
  return fs.readdirSync(TENANTS_DIR).filter(
    (d) => fs.statSync(path.join(TENANTS_DIR, d)).isDirectory(),
  )
}

export async function listTenants(): Promise<TenantSummary[]> {
  const names = listTenantNames()
  return Promise.all(
    names.map(async (name) => {
      const cfg = readTenantConfig(name)!
      const containers = await getTenantStatus(name)
      return { ...cfg, containers }
    }),
  )
}

export async function createTenant(name: string, siteUrl: string): Promise<TenantConfig> {
  if (!/^[a-z][a-z0-9-]{2,29}$/.test(name)) {
    throw new Error('Invalid tenant name: 3–30 chars, lowercase, letters/digits/hyphens, start with letter.')
  }
  const dir = tenantDir(name)
  if (fs.existsSync(dir)) throw new Error(`Tenant '${name}' already exists.`)

  const dbName         = tenantDbName(name)
  const jwtSecret      = generateSecret(40)
  const anonKey        = generateJWT(jwtSecret, 'anon')
  const serviceRoleKey = generateJWT(jwtSecret, 'service_role')
  const s3Key          = generateSecret(16)
  const s3Secret       = generateSecret(32)
  const jwtExp         = Number(process.env.JWT_EXPIRY ?? 3600)
  const domain         = process.env.DOMAIN ?? 'localhost'

  // 1. Postgres
  await createTenantDatabase(dbName)
  await initTenantDatabase(dbName, jwtSecret, jwtExp)

  // 2. Storage directory
  const storagePath = path.join(STORAGE_DIR, name)
  fs.mkdirSync(storagePath, { recursive: true })

  // 3. Save config
  fs.mkdirSync(dir, { recursive: true })
  const config: TenantConfig = {
    name, dbName, siteUrl, jwtSecret, anonKey, serviceRoleKey,
    s3Key, s3Secret, createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(configPath(name), JSON.stringify(config, null, 2))

  // 4. Docker containers (resolve HOST path for storage bind)
  const hostStoragePath = await resolveHostPath(`/project/volumes/storage/${name}`)
  await startTenantContainers({
    tenantName: name, dbName, jwtSecret, anonKey, serviceRoleKey,
    s3Key, s3Secret, siteUrl, hostStoragePath,
  })

  // 5. Nginx
  writeTenantNginxConf(name, domain)
  await reloadNginx()

  return config
}

/**
 * Upgrade a tenant's service containers to the image tags in versions.json.
 *
 * Sequence:
 * 1. Force-pull latest images (so the new tags are cached before we remove the old containers)
 * 2. Stop & remove existing containers
 * 3. Recreate containers with the new images + the same tenant config
 */
export async function upgradeTenant(name: string): Promise<void> {
  const cfg = readTenantConfig(name)
  if (!cfg) throw new Error(`Tenant '${name}' not found.`)

  await pullLatestImages()
  await stopTenantContainers(name)

  const hostStoragePath = await resolveHostPath(`/project/volumes/storage/${name}`)
  await startTenantContainers({
    tenantName:     cfg.name,
    dbName:         cfg.dbName,
    jwtSecret:      cfg.jwtSecret,
    anonKey:        cfg.anonKey,
    serviceRoleKey: cfg.serviceRoleKey,
    s3Key:          cfg.s3Key,
    s3Secret:       cfg.s3Secret,
    siteUrl:        cfg.siteUrl,
    hostStoragePath,
  })
}

export async function deleteTenant(name: string, dropDb: boolean): Promise<void> {
  const cfg = readTenantConfig(name)

  // Stop & remove containers
  await stopTenantContainers(name)

  // Nginx
  removeTenantNginxConf(name)
  await reloadNginx().catch(() => {})

  // Tenant directory
  const dir = tenantDir(name)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })

  if (dropDb && cfg) {
    await dropTenantDatabase(cfg.dbName)
    const storagePath = path.join(STORAGE_DIR, name)
    if (fs.existsSync(storagePath)) fs.rmSync(storagePath, { recursive: true, force: true })
  }
}
