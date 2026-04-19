import fs from 'fs'
import path from 'path'

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue

    const key = match[1]
    let value = match[2]

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

export function loadScriptEnvironment() {
  const cwd = process.cwd()
  loadDotEnvFile(path.join(cwd, '.env.local'))
  loadDotEnvFile(path.join(cwd, '.env'))
}
