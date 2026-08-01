import { spawn } from 'node:child_process'
import { access, copyFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const projectRoot = process.cwd()
const prismaRoot = join(projectRoot, 'prisma')
const templatePath = join(prismaRoot, 'template.db')
const databasePath = join(prismaRoot, 'dev.db')
const incomingPath = join(prismaRoot, '.dev.db.incoming')
const previousPath = join(prismaRoot, '.dev.db.previous')
const prepareTemplateScript = join(projectRoot, 'scripts', 'prepare-template-db.mjs')

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function runTemplateBuild() {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [prepareTemplateScript], {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
      shell: false
    })

    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => {
      if (signal || (code ?? 0) !== 0) {
        rejectPromise(
          new Error(
            signal
              ? `Template build exited with signal ${signal}.`
              : `Template build exited with code ${code}.`
          )
        )
        return
      }
      resolvePromise()
    })
  })
}

function checkpointDevelopmentDatabase() {
  let database = null
  try {
    database = new DatabaseSync(databasePath)
    database.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  } catch {
    // Preserve the raw files when the previous development database is incompatible.
  } finally {
    database?.close()
  }
}

async function backupDevelopmentDatabase() {
  if (!(await exists(databasePath))) return null

  checkpointDevelopmentDatabase()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupRoot = join(prismaRoot, 'dev-backups', timestamp)
  await mkdir(backupRoot, { recursive: true })

  for (const sourcePath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (await exists(sourcePath)) {
      await copyFile(sourcePath, join(backupRoot, sourcePath.split(/[\\/]/).at(-1)))
    }
  }

  return backupRoot
}

async function replaceDevelopmentDatabase() {
  await rm(incomingPath, { force: true })
  await rm(previousPath, { force: true })
  await copyFile(templatePath, incomingPath)

  if ((await stat(incomingPath)).size === 0) {
    throw new Error('The generated database template is empty.')
  }

  const hadPreviousDatabase = await exists(databasePath)
  if (hadPreviousDatabase) {
    await rename(databasePath, previousPath)
  }

  try {
    await rename(incomingPath, databasePath)
    await rm(`${databasePath}-wal`, { force: true })
    await rm(`${databasePath}-shm`, { force: true })
    await rm(previousPath, { force: true })
  } catch (error) {
    if (hadPreviousDatabase && (await exists(previousPath))) {
      await rename(previousPath, databasePath)
    }
    throw error
  } finally {
    await rm(incomingPath, { force: true })
  }
}

async function main() {
  await runTemplateBuild()
  const backupRoot = await backupDevelopmentDatabase()
  await replaceDevelopmentDatabase()
  console.log(`Generated ${databasePath}`)
  if (backupRoot) {
    console.log(`Previous development database backed up to ${backupRoot}`)
  }
}

main().catch((error) => {
  console.error('Failed to prepare prisma/dev.db:', error)
  process.exitCode = 1
})
