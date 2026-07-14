import { useEffect, useState } from 'react'

const LIGHT_CONTRAST = { hex: '#ffffff', rgb: '255, 255, 255' }
const DARK_CONTRAST = { hex: '#000000', rgb: '0, 0, 0' }
const FALLBACK = {
  hex: '#baff00',
  rgb: '186, 255, 0',
  contrastHex: DARK_CONTRAST.hex,
  contrastRgb: DARK_CONTRAST.rgb
}
const PLACEHOLDER_SVG = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22%3E%3Crect width=%22128%22 height=%22128%22 fill=%22%23141414%22/%3E%3Cpath d=%22M45 84V35h42v49%22 fill=%22none%22 stroke=%22%23baff00%22 stroke-width=%228%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/%3E%3Ccircle cx=%2238%22 cy=%2287%22 r=%2213%22 fill=%22%23baff00%22/%3E%3Ccircle cx=%2280%22 cy=%2287%22 r=%2213%22 fill=%22%23baff00%22/%3E%3C/svg%3E'
const CACHE = new Map()
const SAMPLE_SIZE = 48
const SAMPLE_BORDER_INSET = 4
const COLOR_BUCKET_SIZE = 24
const MIN_VISIBLE_SATURATION = 0.18
const MIN_COLORFUL_SATURATION = 0.22
const MAX_NEUTRAL_CHANNEL_DELTA = 18

export async function extractDominantColor(src, cacheKey = src) {
  if (!src || src === PLACEHOLDER_SVG) return FALLBACK

  const normalizedCacheKey = cacheKey || src

  if (CACHE.has(normalizedCacheKey)) return CACHE.get(normalizedCacheKey)

  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    const imageLoaded = new Promise((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = reject
    })

    img.src = src
    await imageLoaded

    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE_SIZE
    canvas.height = SAMPLE_SIZE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return FALLBACK

    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    const candidates = collectCandidateBuckets(data)
    const chosenColor = pickBestCandidate(candidates)
    const result = chosenColor ? formatColorResult(chosenColor) : FALLBACK

    CACHE.set(normalizedCacheKey, result)
    return result
  } catch {
    return FALLBACK
  }
}

function collectCandidateBuckets(data) {
  const buckets = new Map()

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4
    const x = pixelIndex % SAMPLE_SIZE
    const y = Math.floor(pixelIndex / SAMPLE_SIZE)

    if (isBorderSample(x, y)) continue

    const alpha = data[i + 3]
    if (alpha < 180) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const { s, l } = rgbToHsl(r, g, b)

    const bucketKey = [
      quantizeChannel(r),
      quantizeChannel(g),
      quantizeChannel(b)
    ].join(',')

    const edgeDistanceScore = clamp(Math.min(l, 1 - l) / 0.34, 0.08, 1)
    const saturationScore = clamp(0.35 + s * 1.65, 0.35, 2)
    const weight = saturationScore * edgeDistanceScore

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        totalWeight: 0,
        pixelCount: 0,
        r: 0,
        g: 0,
        b: 0
      })
    }

    const bucket = buckets.get(bucketKey)
    bucket.totalWeight += weight
    bucket.pixelCount += 1
    bucket.r += r * weight
    bucket.g += g * weight
    bucket.b += b * weight
  }

  return Array.from(buckets.values())
    .filter((bucket) => bucket.totalWeight > 0)
    .map((bucket) => {
      const r = Math.round(bucket.r / bucket.totalWeight)
      const g = Math.round(bucket.g / bucket.totalWeight)
      const b = Math.round(bucket.b / bucket.totalWeight)
      const { h, s, l } = rgbToHsl(r, g, b)
      const baseScore = bucket.totalWeight * (1 + bucket.pixelCount / 12)
      const colorfulnessScore = clamp(s * 1.8, 0, 1.6)
      const lightnessUsabilityScore = clamp(Math.min(l, 1 - l) / 0.28, 0.18, 1)

      return {
        r,
        g,
        b,
        h,
        s,
        l,
        score: baseScore,
        colorfulScore: baseScore * (1 + colorfulnessScore) * lightnessUsabilityScore
      }
    })
    .sort((left, right) => right.score - left.score)
}

function pickBestCandidate(candidates) {
  const colorfulCandidate = candidates
    .filter((candidate) => !isNeutralCandidate(candidate))
    .sort((left, right) => right.colorfulScore - left.colorfulScore)[0]

  if (colorfulCandidate) {
    return boostColorfulCandidate(colorfulCandidate)
  }

  return null
}

function isNeutralCandidate({ r, g, b, s, l }) {
  const channelDelta = Math.max(r, g, b) - Math.min(r, g, b)

  if (s < MIN_VISIBLE_SATURATION) return true
  if (channelDelta < MAX_NEUTRAL_CHANNEL_DELTA) return true
  if (s < MIN_COLORFUL_SATURATION && channelDelta < MAX_NEUTRAL_CHANNEL_DELTA * 1.8) return true

  return false
}

function boostColorfulCandidate({ h, s, l }) {
  const boostedS = clamp(s * 1.35 + 0.08, Math.max(s, 0.35), 0.9)
  const boostedL = clamp(l < 0.18 ? 0.22 : l > 0.84 ? 0.78 : l, 0.18, 0.82)
  let { r, g, b } = hslToRgb(h, boostedS, boostedL)

  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  if (brightness < 56) {
    const lift = 56 - brightness
    r = Math.min(255, Math.round(r + lift))
    g = Math.min(255, Math.round(g + lift))
    b = Math.min(255, Math.round(b + lift))
  }

  return { r, g, b }
}

function formatColorResult({ r, g, b }) {
  const contrastColor = getContrastColor(r, g, b)

  return {
    hex: `rgb(${r}, ${g}, ${b})`,
    rgb: `${r}, ${g}, ${b}`,
    contrastHex: contrastColor.hex,
    contrastRgb: contrastColor.rgb
  }
}

function quantizeChannel(value) {
  return Math.round(value / COLOR_BUCKET_SIZE) * COLOR_BUCKET_SIZE
}

function isBorderSample(x, y) {
  return (
    x < SAMPLE_BORDER_INSET ||
    y < SAMPLE_BORDER_INSET ||
    x >= SAMPLE_SIZE - SAMPLE_BORDER_INSET ||
    y >= SAMPLE_SIZE - SAMPLE_BORDER_INSET
  )
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getRelativeLuminance(r, g, b) {
  const [normalizedR, normalizedG, normalizedB] = [r, g, b].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * normalizedR + 0.7152 * normalizedG + 0.0722 * normalizedB
}

function getContrastColor(r, g, b) {
  const luminance = getRelativeLuminance(r, g, b)
  const contrastAgainstBlack = getContrastRatio(luminance, 0)
  const contrastAgainstWhite = getContrastRatio(luminance, 1)

  return contrastAgainstBlack >= contrastAgainstWhite ? DARK_CONTRAST : LIGHT_CONTRAST
}

function getContrastRatio(firstLuminance, secondLuminance) {
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

export function getContrastColorForBackground(color) {
  if (!color || typeof color !== 'string') {
    return FALLBACK.contrastHex
  }

  const parsed = parseColorString(color)
  if (!parsed) {
    return FALLBACK.contrastHex
  }

  return getContrastColor(parsed.r, parsed.g, parsed.b).hex
}

function parseColorString(color) {
  const normalized = color.trim()

  if (normalized.startsWith('#')) {
    return parseHexColor(normalized)
  }

  const rgbMatch = normalized.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
  if (!rgbMatch) {
    return null
  }

  return {
    r: clamp(Number.parseInt(rgbMatch[1], 10), 0, 255),
    g: clamp(Number.parseInt(rgbMatch[2], 10), 0, 255),
    b: clamp(Number.parseInt(rgbMatch[3], 10), 0, 255)
  }
}

function parseHexColor(color) {
  const hex = color.slice(1)
  const normalizedHex =
    hex.length === 3
      ? hex
          .split('')
          .map((value) => value + value)
          .join('')
      : hex

  if (!/^[0-9a-f]{6}$/i.test(normalizedHex)) {
    return null
  }

  return {
    r: Number.parseInt(normalizedHex.slice(0, 2), 16),
    g: Number.parseInt(normalizedHex.slice(2, 4), 16),
    b: Number.parseInt(normalizedHex.slice(4, 6), 16)
  }
}

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h
  let s
  const l = (max + min) / 2

  if (max === min) {
    h = 0
    s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      default:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return { h, s, l }
}

function hslToRgb(h, s, l) {
  let r
  let g
  let b

  if (s === 0) {
    r = l
    g = l
    b = l
  } else {
    const hue2rgb = (p, q, t) => {
      let normalizedT = t

      if (normalizedT < 0) normalizedT += 1
      if (normalizedT > 1) normalizedT -= 1
      if (normalizedT < 1 / 6) return p + (q - p) * 6 * normalizedT
      if (normalizedT < 1 / 2) return q
      if (normalizedT < 2 / 3) return p + (q - p) * (2 / 3 - normalizedT) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

export function useDominantColor(src) {
  const [color, setColor] = useState(FALLBACK)

  useEffect(() => {
    if (!src) {
      setColor(FALLBACK)
      return
    }

    let alive = true
    extractDominantColor(src).then((nextColor) => {
      if (alive) setColor(nextColor)
    })

    return () => {
      alive = false
    }
  }, [src])

  return color
}
