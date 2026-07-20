export interface Mp3Asset {
  audioUrl: string
  coverUrl: string
  hasEmbeddedCover: boolean
  title: string
  artist: string
  durationSeconds: number
  warning: string | null
  revoke: () => void
}

interface EmbeddedPicture {
  data: Uint8Array
  format?: string
}

interface ParsedMetadata {
  common?: {
    title?: string
    artist?: string
    picture?: EmbeddedPicture[]
  }
  format?: { duration?: number }
}

type ParseMetadata = (file: Blob) => Promise<ParsedMetadata>
type ObjectUrlApi = Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>

export function isMp3File(file: File): boolean {
  return file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')
}

export function createPlaceholderCoverDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#242830"/><stop offset="1" stop-color="#090a0c"/></linearGradient></defs><rect width="640" height="640" rx="48" fill="url(#g)"/><circle cx="320" cy="320" r="168" fill="none" stroke="#baff00" stroke-width="20" opacity=".88"/><circle cx="320" cy="320" r="44" fill="#baff00"/><path d="M320 152a168 168 0 0 1 168 168" fill="none" stroke="#7f5cff" stroke-width="20" stroke-linecap="round"/><text x="320" y="555" fill="#f7f8fa" font-family="sans-serif" font-size="34" text-anchor="middle">ELEVATE VIZ</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

async function defaultParseMetadata(file: Blob): Promise<ParsedMetadata> {
  const { parseBlob } = await import('music-metadata')
  return parseBlob(file, { duration: true })
}

export async function createMp3Asset(
  file: File,
  options: { parseMetadata?: ParseMetadata; urlApi?: ObjectUrlApi } = {}
): Promise<Mp3Asset> {
  if (!isMp3File(file)) {
    throw new Error('Selecciona un archivo MP3 válido.')
  }

  const urlApi = options.urlApi ?? URL
  const parseMetadata = options.parseMetadata ?? defaultParseMetadata
  const audioUrl = urlApi.createObjectURL(file)
  let coverObjectUrl: string | null = null

  try {
    const metadata = await parseMetadata(file)
    const picture = metadata.common?.picture?.[0]

    if (picture?.data?.byteLength) {
      const bytes = new Uint8Array(picture.data)
      coverObjectUrl = urlApi.createObjectURL(
        new Blob([bytes.buffer], { type: picture.format || 'image/jpeg' })
      )
    }

    return {
      audioUrl,
      coverUrl: coverObjectUrl ?? createPlaceholderCoverDataUrl(),
      hasEmbeddedCover: Boolean(coverObjectUrl),
      title: metadata.common?.title?.trim() || file.name.replace(/\.mp3$/i, ''),
      artist: metadata.common?.artist?.trim() || 'Artista desconocido',
      durationSeconds: Number(metadata.format?.duration) || 0,
      warning: null,
      revoke: () => {
        urlApi.revokeObjectURL(audioUrl)
        if (coverObjectUrl) urlApi.revokeObjectURL(coverObjectUrl)
      }
    }
  } catch (error) {
    return {
      audioUrl,
      coverUrl: createPlaceholderCoverDataUrl(),
      hasEmbeddedCover: false,
      title: file.name.replace(/\.mp3$/i, ''),
      artist: 'Metadata no disponible',
      durationSeconds: 0,
      warning: error instanceof Error ? error.message : 'No se pudo leer la metadata ID3.',
      revoke: () => urlApi.revokeObjectURL(audioUrl)
    }
  }
}
