import { useEffect, useState } from 'react'

const DEFAULT = { hex: '#2e2e34', rgb: '46, 46, 52' }
const cache = new Map()

export async function extractDominantColor(src) {
  if (!src || src === 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22%3E%3Crect width=%22128%22 height=%22128%22 fill=%22%23141414%22/%3E%3Cpath d=%22M45 84V35h42v49%22 fill=%22none%22 stroke=%22%23baff00%22 stroke-width=%228%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/%3E%3Ccircle cx=%2238%22 cy=%2287%22 r=%2213%22 fill=%22%23baff00%22/%3E%3Ccircle cx=%2280%22 cy=%2287%22 r=%2213%22 fill=%22%23baff00%22/%3E%3C/svg%3E') return DEFAULT

  if (cache.has(src)) return cache.get(src)

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
    const size = 32
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return DEFAULT

    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)

    let r = 0
    let g = 0
    let b = 0
    let totalWeight = 0

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 180) continue

      const pr = data[i]
      const pg = data[i + 1]
      const pb = data[i + 2]
      const lum = pr * 0.299 + pg * 0.587 + pb * 0.114

      if (lum < 24 || lum > 238) continue

      const { s, l } = rgbToHsl(pr, pg, pb)
      const lightnessScore = 1 - Math.abs(l - 0.55)
      const saturationScore = Math.max(0.12, s)
      const weight = saturationScore * saturationScore * lightnessScore

      r += pr * weight
      g += pg * weight
      b += pb * weight
      totalWeight += weight
    }

    if (totalWeight === 0) return DEFAULT

    r = Math.round(r / totalWeight)
    g = Math.round(g / totalWeight)
    b = Math.round(b / totalWeight)

    const { h, s, l } = rgbToHsl(r, g, b)
    if (s < 0.04) return DEFAULT

    const boostedS = clamp(s * 1.9 + 0.18, 0.58, 0.92)
    const boostedL = clamp(l < 0.42 ? l + 0.16 : l, 0.46, 0.64)
    const { r: rr, g: rg, b: rb } = hslToRgb(h, boostedS, boostedL)
    r = rr
    g = rg
    b = rb

    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    if (brightness < 90) {
      const lift = 90 - brightness
      r = Math.min(255, Math.round(r + lift))
      g = Math.min(255, Math.round(g + lift))
      b = Math.min(255, Math.round(b + lift))
    }

    const result = { hex: `rgb(${r}, ${g}, ${b})`, rgb: `${r}, ${g}, ${b}` }
    cache.set(src, result)
    return result
  } catch {
    return DEFAULT
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h, s, l }
}

function hslToRgb(h, s, l) {
  let r, g, b
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

export function useDominantColor(src) {
  const [color, setColor] = useState(DEFAULT)

  useEffect(() => {
    if (!src) return
    let alive = true
    extractDominantColor(src).then(c => {
      if (alive) setColor(c)
    })
    return () => { alive = false }
  }, [src])

  return color
}
