import Docker from 'dockerode'
import fs from 'fs'
import path from 'path'

export const docker = new Docker({ socketPath: '/var/run/docker.sock' })

/** Read versions.json fresh on every call so upgrades pick up the latest tags. */
function loadVersions(): Record<string, string> {
  const p = path.join(process.env.PROJECT_DIR ?? '/project', 'versions.json')
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}

/** Image tags resolved from versions.json (or built-in defaults). */
export function resolveImages() {
  const v = loadVersions()
  return {
    auth:    v.gotrue    ?? 'supabase/gotrue:v2.186.0',
    rest:    v.postgrest ?? 'postgrest/postgrest:v14.8',
    storage: v.storage   ?? 'supabase/storage-api:v1.48.26',
  }
}

const NETWORK = 'supabase-net'

export interface TenantContainerConfig {
  tenantName:      string
  dbName:          string
  jwtSecret:       string
  anonKey:         string
  serviceRoleKey:  string
  s3Key:           string
  s3Secret:        string
  siteUrl:         string
  hostStoragePath: string // absolute path on HOST (not inside admin container)
}

const pgPass   = () => process.env.POSTGRES_PASSWORD ?? ''
const pgHost   = () => process.env.POSTGRES_HOST ?? 'db'
const pgPort   = () => process.env.POSTGRES_PORT ?? '5432'
const jwtExpiry = () => process.env.JWT_EXPIRY ?? '3600'
const smtp = () => ({
  host:         process.env.SMTP_HOST          ?? '',
  port:         process.env.SMTP_PORT          ?? '587',
  user:         process.env.SMTP_USER          ?? '',
  pass:         process.env.SMTP_PASS          ?? '',
  adminEmail:   process.env.SMTP_ADMIN_EMAIL   ?? 'admin@example.com',
  senderName:   process.env.SMTP_SENDER_NAME   ?? 'Supabase',
  autoConfirm:  process.env.ENABLE_EMAIL_AUTOCONFIRM ?? 'false',
})

async function pullImage(image: string, force = false) {
  if (!force) {
    try {
      await docker.getImage(image).inspect()
      return  // already present
    } catch { /* fall through to pull */ }
  }
  await new Promise<void>((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err)
      docker.modem.followProgress(stream, (e: Error | null) => e ? reject(e) : resolve())
    })
  })
}

async function startContainer(opts: Docker.ContainerCreateOptions): Promise<Docker.Container> {
  const c = await docker.createContainer(opts)
  await c.start()
  return c
}

export async function startTenantContainers(cfg: TenantContainerConfig): Promise<void> {
  const { tenantName: n, dbName, jwtSecret, anonKey, serviceRoleKey, s3Key, s3Secret, siteUrl, hostStoragePath } = cfg
  const s = smtp()
  const imgs = resolveImages()

  await Promise.all([
    pullImage(imgs.auth),
    pullImage(imgs.rest),
    pullImage(imgs.storage),
  ])

  // ── Auth ──────────────────────────────────────────────────────────────────
  await startContainer({
    name: `auth-${n}`,
    Image: imgs.auth,
    Env: [
      'GOTRUE_API_HOST=0.0.0.0',
      'GOTRUE_API_PORT=9999',
      `API_EXTERNAL_URL=${siteUrl}`,
      'GOTRUE_DB_DRIVER=postgres',
      `GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:${pgPass()}@${pgHost()}:${pgPort()}/${dbName}`,
      `GOTRUE_SITE_URL=${siteUrl}`,
      'GOTRUE_URI_ALLOW_LIST=',
      'GOTRUE_DISABLE_SIGNUP=false',
      'GOTRUE_JWT_ADMIN_ROLES=service_role',
      'GOTRUE_JWT_AUD=authenticated',
      'GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated',
      `GOTRUE_JWT_EXP=${jwtExpiry()}`,
      `GOTRUE_JWT_SECRET=${jwtSecret}`,
      'GOTRUE_EXTERNAL_EMAIL_ENABLED=true',
      `GOTRUE_MAILER_AUTOCONFIRM=${s.autoConfirm}`,
      `GOTRUE_SMTP_ADMIN_EMAIL=${s.adminEmail}`,
      `GOTRUE_SMTP_HOST=${s.host}`,
      `GOTRUE_SMTP_PORT=${s.port}`,
      `GOTRUE_SMTP_USER=${s.user}`,
      `GOTRUE_SMTP_PASS=${s.pass}`,
      `GOTRUE_SMTP_SENDER_NAME=${s.senderName}`,
      'GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify',
      'GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify',
      'GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify',
      'GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify',
      'GOTRUE_EXTERNAL_PHONE_ENABLED=false',
      'GOTRUE_SMS_AUTOCONFIRM=true',
    ],
    HostConfig: {
      RestartPolicy: { Name: 'unless-stopped' },
    },
    NetworkingConfig: { EndpointsConfig: { [NETWORK]: {} } },
  })

  // ── REST ──────────────────────────────────────────────────────────────────
  await startContainer({
    name: `rest-${n}`,
    Image: imgs.rest,
    Cmd: ['postgrest'],
    Env: [
      `PGRST_DB_URI=postgres://authenticator:${pgPass()}@${pgHost()}:${pgPort()}/${dbName}`,
      'PGRST_DB_SCHEMAS=public,storage,graphql_public',
      'PGRST_DB_ANON_ROLE=anon',
      `PGRST_JWT_SECRET=${jwtSecret}`,
      'PGRST_DB_USE_LEGACY_GUCS=false',
      `PGRST_APP_SETTINGS_JWT_SECRET=${jwtSecret}`,
      `PGRST_APP_SETTINGS_JWT_EXP=${jwtExpiry()}`,
    ],
    HostConfig: {
      RestartPolicy: { Name: 'unless-stopped' },
    },
    NetworkingConfig: { EndpointsConfig: { [NETWORK]: {} } },
  })

  // ── Storage ───────────────────────────────────────────────────────────────
  await startContainer({
    name: `storage-${n}`,
    Image: imgs.storage,
    Env: [
      `ANON_KEY=${anonKey}`,
      `SERVICE_KEY=${serviceRoleKey}`,
      `POSTGREST_URL=http://rest-${n}:3000`,
      `AUTH_JWT_SECRET=${jwtSecret}`,
      `DATABASE_URL=postgres://supabase_storage_admin:${pgPass()}@${pgHost()}:${pgPort()}/${dbName}`,
      `STORAGE_PUBLIC_URL=${siteUrl}/storage/v1`,
      'REQUEST_ALLOW_X_FORWARDED_PATH=true',
      'FILE_SIZE_LIMIT=52428800',
      'STORAGE_BACKEND=file',
      `GLOBAL_S3_BUCKET=${n}`,
      'FILE_STORAGE_BACKEND_PATH=/var/lib/storage',
      `TENANT_ID=${n}`,
      'REGION=local',
      'ENABLE_IMAGE_TRANSFORMATION=true',
      'IMGPROXY_URL=http://imgproxy:5001',
      `S3_PROTOCOL_ACCESS_KEY_ID=${s3Key}`,
      `S3_PROTOCOL_ACCESS_KEY_SECRET=${s3Secret}`,
    ],
    HostConfig: {
      RestartPolicy: { Name: 'unless-stopped' },
      Binds: [`${hostStoragePath}:/var/lib/storage:z`],
    },
    NetworkingConfig: { EndpointsConfig: { [NETWORK]: {} } },
  })
}

export async function stopTenantContainers(tenantName: string): Promise<void> {
  for (const prefix of ['rest', 'auth', 'storage']) {
    const name = `${prefix}-${tenantName}`
    try {
      const c = docker.getContainer(name)
      await c.stop({ t: 5 }).catch(() => {})
      await c.remove({ force: true })
    } catch { /* already gone */ }
  }
}

/**
 * Restart all three tenant containers in-place (no image change).
 * Much faster than a full upgrade — just signals Docker to restart each one.
 */
export async function restartTenantContainers(tenantName: string): Promise<void> {
  for (const prefix of ['auth', 'rest', 'storage']) {
    try {
      await docker.getContainer(`${prefix}-${tenantName}`).restart({ t: 10 })
    } catch { /* container missing or already restarting — skip */ }
  }
}

/**
 * Restart a single service container for a tenant.
 * `service` must be one of: 'auth' | 'rest' | 'storage'.
 */
export async function restartSingleTenantContainer(
  tenantName: string,
  service: 'auth' | 'rest' | 'storage',
): Promise<void> {
  await docker.getContainer(`${service}-${tenantName}`).restart({ t: 10 })
}

/**
 * Force-pull the latest images from versions.json then return the resolved tags.
 * Used by the upgrade flow before recreating containers.
 */
export async function pullLatestImages(): Promise<ReturnType<typeof resolveImages>> {
  const imgs = resolveImages()
  await Promise.all([
    pullImage(imgs.auth,    true),
    pullImage(imgs.rest,    true),
    pullImage(imgs.storage, true),
  ])
  return imgs
}

export interface ContainerStatus {
  name:   string
  status: 'running' | 'stopped' | 'error' | 'missing'
  health?: string
  image?: string
}

export async function getTenantStatus(tenantName: string): Promise<ContainerStatus[]> {
  const results: ContainerStatus[] = []
  for (const prefix of ['auth', 'rest', 'storage']) {
    const name = `${prefix}-${tenantName}`
    try {
      const info = await docker.getContainer(name).inspect()
      results.push({
        name:   prefix,
        status: info.State.Running ? 'running' : 'stopped',
        health: info.State.Health?.Status,
        image:  info.Config.Image,
      })
    } catch {
      results.push({ name: prefix, status: 'missing' })
    }
  }
  return results
}

/** Returns the HOST path for a path inside the admin container.
 *  Uses self-inspection so volume mounts for tenant storage are correct. */
export async function resolveHostPath(containerPath: string): Promise<string> {
  const selfName = process.env.CONTAINER_NAME ?? 'supabase-admin'
  try {
    const info = await docker.getContainer(selfName).inspect()
    const mount = info.Mounts.find((m) => m.Destination === '/project')
    if (mount?.Source) {
      return containerPath.replace('/project', mount.Source)
    }
  } catch { /* fallback */ }
  return containerPath
}

export async function reloadNginx(): Promise<void> {
  const c = docker.getContainer('supabase-nginx')
  const exec = await c.exec({
    Cmd: ['nginx', '-s', 'reload'],
    AttachStdout: true,
    AttachStderr: true,
  })
  await exec.start({})
}
