import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import packageJson from '../package.json' with { type: 'json' }

const EXPECTED_PRISMA_VERSION = '7.8.0'
const projectRoot = process.cwd()
const prismaCliPath = join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js')
const prismaConfigPath = join(projectRoot, 'prisma.config.ts')
const packageVersions = [
  packageJson.devDependencies?.prisma,
  packageJson.dependencies?.['@prisma/client'],
  packageJson.dependencies?.['@prisma/adapter-libsql']
]

function runPrisma(args, databaseUrl) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [prismaCliPath, ...args], {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {})
      },
      stdio: 'inherit',
      shell: false
    })

    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => {
      if (signal || (code ?? 0) !== 0) {
        rejectPromise(
          new Error(
            signal ? `Prisma exited with signal ${signal}.` : `Prisma exited with code ${code}.`
          )
        )
        return
      }
      resolvePromise()
    })
  })
}

function toPrismaFileUrl(filePath) {
  return `file:${filePath.replace(/\\/g, '/')}`
}

async function main() {
  if (packageVersions.some((version) => version !== EXPECTED_PRISMA_VERSION)) {
    throw new Error(`All Prisma packages must be pinned to ${EXPECTED_PRISMA_VERSION}.`)
  }

  const temporaryRoot = await mkdtemp(join(tmpdir(), 'elevate-prisma-check-'))
  const databasePath = resolve(temporaryRoot, 'check.db')
  const databaseUrl = toPrismaFileUrl(databasePath)

  try {
    await writeFile(databasePath, '')
    await runPrisma(['validate', '--config', prismaConfigPath], databaseUrl)
    await runPrisma(['generate', '--config', prismaConfigPath], databaseUrl)
    await runPrisma(['migrate', 'deploy', '--config', prismaConfigPath], databaseUrl)
    await runPrisma(['migrate', 'status', '--config', prismaConfigPath], databaseUrl)
    await runPrisma(
      [
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        join(projectRoot, 'prisma', 'schema.prisma'),
        '--exit-code',
        '--config',
        prismaConfigPath
      ],
      databaseUrl
    )
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error('Prisma integrity check failed:', error)
  process.exitCode = 1
})
