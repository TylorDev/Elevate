import { copyFile, mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const REDIST_URL = 'https://aka.ms/vc14/vc_redist.x64.exe'
const outputPath = resolve('build/redist/vc_redist.x64.exe')
const minExpectedSizeBytes = 1_000_000

async function assertUsableFile(path) {
  const file = await stat(path)

  if (!file.isFile() || file.size < minExpectedSizeBytes) {
    throw new Error(`VC++ Redistributable file is unexpectedly small: ${path} (${file.size} bytes)`)
  }
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url, { redirect: 'follow' })

  if (!response.ok || !response.body) {
    throw new Error(`Download failed with HTTP ${response.status} ${response.statusText}`)
  }

  await mkdir(dirname(destinationPath), { recursive: true })
  await writeFile(destinationPath, Buffer.from(await response.arrayBuffer()))
}

async function prepareVcRedist() {
  await mkdir(dirname(outputPath), { recursive: true })

  const localSource = process.env.VC_REDIST_X64_PATH?.trim()
  if (localSource) {
    const sourcePath = resolve(localSource)
    await assertUsableFile(sourcePath)
    await copyFile(sourcePath, outputPath)
    console.log(`[vc-redist] Copied VC++ Redistributable from ${sourcePath}`)
    return
  }

  try {
    await assertUsableFile(outputPath)
    console.log(`[vc-redist] Reusing ${outputPath}`)
    return
  } catch {
    // Download below.
  }

  const tempPath = join(dirname(outputPath), 'vc_redist.x64.exe.download')

  try {
    await unlink(tempPath).catch(() => {})
    console.log(`[vc-redist] Downloading ${REDIST_URL}`)
    await downloadFile(REDIST_URL, tempPath)
    await assertUsableFile(tempPath)
    await rename(tempPath, outputPath)
    console.log(`[vc-redist] Saved ${outputPath}`)
  } catch (error) {
    await unlink(tempPath).catch(() => {})
    throw new Error(
      [
        'Unable to prepare Microsoft Visual C++ Redistributable x64.',
        `Download URL: ${REDIST_URL}`,
        'For offline builds, set VC_REDIST_X64_PATH to a local vc_redist.x64.exe.',
        `Cause: ${error.message}`
      ].join('\n')
    )
  }
}

await prepareVcRedist()
