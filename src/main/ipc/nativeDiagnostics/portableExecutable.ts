import { existsSync, readFileSync } from 'node:fs'
import type { PortableExecutableSection } from '../../Types/nativeDiagnostics.ts'

export function rvaToOffset(sections: PortableExecutableSection[], rva: number): number {
  const section = sections.find((candidate) => {
    const sectionSize = Math.max(candidate.virtualSize, candidate.rawSize)
    return rva >= candidate.virtualAddress && rva < candidate.virtualAddress + sectionSize
  })

  if (!section) {
    throw new Error(`Unable to map PE RVA 0x${rva.toString(16)} to a file section.`)
  }

  return section.rawPointer + (rva - section.virtualAddress)
}

export function readNullTerminatedAscii(buffer: Buffer, offset: number): string {
  const end = buffer.indexOf(0, offset)
  return buffer.toString('ascii', offset, end === -1 ? undefined : end)
}

export function readPortableExecutableImports(filePath: string | null): string[] {
  if (!filePath || !filePath.endsWith('.node') || !existsSync(filePath)) {
    return []
  }

  const buffer = readFileSync(filePath)
  const peHeaderOffset = buffer.readUInt32LE(0x3c)
  const optionalHeaderOffset = peHeaderOffset + 24
  const optionalHeaderMagic = buffer.readUInt16LE(optionalHeaderOffset)
  const dataDirectoryOffset = optionalHeaderOffset + (optionalHeaderMagic === 0x20b ? 112 : 96)
  const importTableRva = buffer.readUInt32LE(dataDirectoryOffset + 8)

  if (!importTableRva) {
    return []
  }

  const sectionCount = buffer.readUInt16LE(peHeaderOffset + 6)
  const sectionTableOffset = optionalHeaderOffset + buffer.readUInt16LE(peHeaderOffset + 20)
  const sections: PortableExecutableSection[] = []

  for (let index = 0; index < sectionCount; index += 1) {
    const offset = sectionTableOffset + index * 40
    sections.push({
      virtualSize: buffer.readUInt32LE(offset + 8),
      virtualAddress: buffer.readUInt32LE(offset + 12),
      rawSize: buffer.readUInt32LE(offset + 16),
      rawPointer: buffer.readUInt32LE(offset + 20)
    })
  }

  const imports: string[] = []
  for (let offset = rvaToOffset(sections, importTableRva); ; offset += 20) {
    const nameRva = buffer.readUInt32LE(offset + 12)
    if (!nameRva) break
    imports.push(readNullTerminatedAscii(buffer, rvaToOffset(sections, nameRva)))
  }

  return imports.sort((left, right) => left.localeCompare(right))
}
