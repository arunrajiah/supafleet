import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface AppState {
  setupComplete: boolean
  adminPasswordHash: string
  sessionSecret: string
}

const STATE_PATH = path.join(process.env.PROJECT_DIR ?? '/project', '.multidb', 'state.json')

export function readState(): AppState | null {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as AppState
  } catch {
    return null
  }
}

export function writeState(state: AppState): void {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

export function isSetupComplete(): boolean {
  return readState()?.setupComplete === true
}

export function getSessionSecret(): string {
  const state = readState()
  if (state?.sessionSecret) return state.sessionSecret
  return crypto.randomBytes(32).toString('hex')
}
