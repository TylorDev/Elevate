import { spawn } from 'node:child_process'
import { join } from 'node:path'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const [command = 'dev', ...appArgs] = process.argv.slice(2)
const cli = process.execPath
const cliArgs = [join(process.cwd(), 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), command]

if (appArgs.length > 0) {
  cliArgs.push('--', ...appArgs)
}

const child = spawn(cli, cliArgs, {
  env,
  stdio: 'inherit'
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
