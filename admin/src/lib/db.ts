import { Client, Pool } from 'pg'
import fs from 'fs'
import path from 'path'

const baseConfig = {
  host:     process.env.POSTGRES_HOST     ?? 'db',
  port:     Number(process.env.POSTGRES_PORT ?? 5432),
  user:     'postgres',
  password: process.env.POSTGRES_PASSWORD ?? '',
  database: 'postgres',
}

export async function createTenantDatabase(dbName: string): Promise<void> {
  const client = new Client(baseConfig)
  await client.connect()
  try {
    await client.query(`CREATE DATABASE "${dbName}"`)
  } finally {
    await client.end()
  }
}

export async function dropTenantDatabase(dbName: string): Promise<void> {
  const client = new Client(baseConfig)
  await client.connect()
  try {
    // Terminate existing connections first
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM   pg_stat_activity
      WHERE  datname = $1 AND pid <> pg_backend_pid()
    `, [dbName])
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`)
  } finally {
    await client.end()
  }
}

export async function initTenantDatabase(
  dbName: string,
  jwtSecret: string,
  jwtExp: number,
): Promise<void> {
  const templatePath = path.join(
    process.env.PROJECT_DIR ?? '/project',
    'scripts',
    'init-tenant.sql',
  )
  const raw = fs.readFileSync(templatePath, 'utf8')
  const sql = raw
    .replace(/\{\{JWT_SECRET\}\}/g, jwtSecret)
    .replace(/\{\{JWT_EXP\}\}/g, String(jwtExp))

  const client = new Client({ ...baseConfig, database: dbName })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

export async function databaseExists(dbName: string): Promise<boolean> {
  const pool = new Pool(baseConfig)
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    )
    return rows.length > 0
  } finally {
    await pool.end()
  }
}
