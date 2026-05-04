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
    const size = 10
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return DEFAULT

    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)

    let r = 0, g = 0, b = 0, count = 0
    for (let i = 0; i < data.length; i += 4) {
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      if (lum > 30 && lum < 220) {
        r += data[i]
        g += data[i + 1]
        b += data[i + 2]
        count++
      }
    }
    if (count === 0) return DEFAULT

    r = Math.round(r / count)
    g = Math.round(g / count)
    b = Math.round(b / count)

    const { h, s, l } = rgbToHsl(r, g, b)
    const boostedS = Math.min(1, s * 1.4)
    const { r: rr, g: rg, b: rb } = hslToRgb(h, boostedS, l)
    r = rr
    g = rg
    b = rb

    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    if (brightness < 60) {
      r = Math.min(255, r + 60)
      g = Math.min(255, g + 60)
      b = Math.min(255, b + 60)
    }

    const result = { hex: `rgb(${r}, ${g}, ${b})`, rgb: `${r}, ${g}, ${b}` }
    cache.set(src, result)
    return result
  } catch {
    return DEFAULT
  }
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