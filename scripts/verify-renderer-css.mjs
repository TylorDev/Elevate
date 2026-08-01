import fs from 'node:fs'
import path from 'node:path'

const assetsRoot = path.resolve('out/renderer/assets')
const requiredSelectors = [
  '.overflow-menu-container',
  '.overflow-dropdown',
  '.overflow-item',
  '.ui-select__content',
  '.ui-select__item',
  '.empty-state',
  '.preset-card',
  '.preset-button',
  '.preset-item'
]

function collectCssFiles(directory) {
  if (!fs.existsSync(directory)) return []

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectCssFiles(entryPath)
    return entry.isFile() && entry.name.endsWith('.css') ? [entryPath] : []
  })
}

const cssFiles = collectCssFiles(assetsRoot)
if (cssFiles.length === 0) {
  throw new Error(`No renderer CSS assets found under ${assetsRoot}`)
}

const css = cssFiles.map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n')
const missingSelectors = requiredSelectors.filter((selector) => !css.includes(selector))

if (missingSelectors.length > 0) {
  throw new Error(
    `Missing required ElevateViz selectors in renderer CSS: ${missingSelectors.join(', ')}`
  )
}

console.log(
  `[verify:renderer-css] ${cssFiles.length} CSS assets contain all ${requiredSelectors.length} required selectors`
)
