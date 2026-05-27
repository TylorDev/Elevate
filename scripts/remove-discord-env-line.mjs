import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const sensitiveKey = process.env.SENSITIVE_ENV_KEY || 'DISCORD_CLIENT_ID'
const sensitiveValue = process.env.SENSITIVE_ENV_VALUE || ''
const root = process.argv[2] || process.cwd()

function shouldSkipDirectory(name) {
  return ['.git', 'node_modules', 'dist', 'out'].includes(name)
}

function shouldInspectFile(name) {
  return name === '.env' || (name.startsWith('.env.') && name !== '.env.example')
}

function isProbablyText(buffer) {
  return !buffer.includes(0)
}

function cleanFile(path) {
  const buffer = readFileSync(path)

  if (!isProbablyText(buffer)) {
    return
  }

  const original = buffer.toString('utf8')
  const cleanedLines = original
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim()
      return !(
        trimmed.startsWith(`${sensitiveKey}=`) ||
        (sensitiveValue && trimmed.includes(sensitiveValue))
      )
    })

  let cleaned = cleanedLines.join('\n')

  if (original.endsWith('\n') || original.endsWith('\r\n')) {
    cleaned += '\n'
  }

  if (cleaned !== original) {
    writeFileSync(path, cleaned, 'utf8')
  }
}

function redactValue(path) {
  if (!sensitiveValue) {
    return
  }

  const buffer = readFileSync(path)

  if (!isProbablyText(buffer)) {
    return
  }

  const original = buffer.toString('utf8')
  const cleaned = original.split(sensitiveValue).join('[removed-discord-client-id]')

  if (cleaned !== original) {
    writeFileSync(path, cleaned, 'utf8')
  }
}

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stats = statSync(path)

    if (stats.isDirectory()) {
      if (!shouldSkipDirectory(entry)) {
        walk(path)
      }
      continue
    }

    if (stats.isFile()) {
      if (shouldInspectFile(entry)) {
        cleanFile(path)
      } else {
        redactValue(path)
      }
    }
  }
}

walk(root)
