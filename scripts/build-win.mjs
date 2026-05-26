import { spawn } from 'node:child_process'
import { join } from 'node:path'

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit'
    })

    child.on('error', (error) => {
      reject(new Error(`${label} failed to start: ${error.message}`))
    })

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${label} exited with signal ${signal}`))
        return
      }

      if ((code ?? 0) !== 0) {
        reject(new Error(`${label} exited with code ${code ?? 0}`))
        return
      }

      resolve()
    })
  })
}

const npmCli =
  process.env.npm_execpath ||
  join(process.cwd(), 'node_modules', 'npm', 'bin', 'npm-cli.js')
const builderCli = join(process.cwd(), 'node_modules', 'electron-builder', 'cli.js')
const hasGithubToken = Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN)
const publishMode = hasGithubToken ? 'always' : 'never'

console.log(`[build:win] GitHub release publishing: ${hasGithubToken ? 'enabled' : 'disabled'}`)

await run(process.execPath, [npmCli, 'run', 'build'], 'npm run build')
await run(process.execPath, [builderCli, '--win', '--publish', publishMode], 'electron-builder --win')
