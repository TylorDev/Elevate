import fs from 'node:fs'
import { join } from 'node:path'

export function resolveMainIconPath(
  mainDir: string,
  resourcesPath = process.resourcesPath
): string {
  const candidates = [
    join(resourcesPath || '', 'icon.png'),
    join(resourcesPath || '', 'resources', 'icon.png'),
    join(mainDir, '../../resources/icon.png'),
    join(mainDir, '../../../resources/icon.png')
  ]

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || ''
}

export function createSvgDataUrl(svgMarkup: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`
}
