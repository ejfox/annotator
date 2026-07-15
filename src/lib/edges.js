/**
 * Pixel-contrast content edges — the "Edges" snap source.
 *
 * Smoothed projection profiles over an ink mask, so a block's individual text
 * lines don't each register as an edge; we want the boundaries of the block,
 * not the leading. Ported unchanged from the vanilla build.
 */

const cache = new Map()

export function clearEdgeCache() {
  cache.clear()
}

/**
 * @param {HTMLImageElement} img loaded page image
 * @param {string} key cache key (page index + src)
 * @returns {{x:number[], y:number[]}} edge positions in image px
 */
export function detectEdges(img, key) {
  if (cache.has(key)) return cache.get(key)
  const out = { x: [], y: [] }
  try {
    const natW = img.naturalWidth, natH = img.naturalHeight
    const sw = Math.min(520, natW), s = sw / natW
    const cw = Math.round(natW * s), ch = Math.round(natH * s)
    const c = document.createElement('canvas')
    c.width = cw; c.height = ch
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, cw, ch)
    const d = ctx.getImageData(0, 0, cw, ch).data
    const rows = new Float32Array(ch), cols = new Float32Array(cw)
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const i = (y * cw + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2]
        const gray = 0.299 * r + 0.587 * g + 0.114 * b
        const sat = Math.max(r, g, b) - Math.min(r, g, b)
        if (gray < 200 || sat > 45) { rows[y]++; cols[x]++ }
      }
    }
    for (let y = 0; y < ch; y++) rows[y] /= cw
    for (let x = 0; x < cw; x++) cols[x] /= ch
    const smooth = (v, w) => {
      w = Math.max(3, w | 1)
      const h = (w - 1) / 2, o = new Float32Array(v.length)
      for (let i = 0; i < v.length; i++) {
        let sum = 0, n = 0
        for (let k = -h; k <= h; k++) { const j = i + k; if (j >= 0 && j < v.length) { sum += v[j]; n++ } }
        o[i] = sum / n
      }
      return o
    }
    const band = (sm, thr) => {
      const e = []
      for (let i = 1; i < sm.length; i++) if ((sm[i - 1] > thr) !== (sm[i] > thr)) e.push(i)
      return e
    }
    const ys = band(smooth(rows, Math.round(0.012 * ch)), 0.04)
    const xs = band(smooth(cols, Math.round(0.012 * cw)), 0.04)
    // thin full-width rules land as precise y snaps
    for (let i = 2; i < ch - 2; i++) if (rows[i] > 0.5 && rows[i - 2] < 0.25 && rows[i + 2] < 0.25) ys.push(i)
    const merge = (v, tol) => {
      const u = [...new Set(v.map(Math.round))].sort((a, b) => a - b)
      const o = []
      for (const x of u) if (!o.length || x - o[o.length - 1] > tol) o.push(x)
      return o
    }
    out.x = merge(xs, 4).map((v) => v / s)
    out.y = merge(ys, 4).map((v) => v / s)
  } catch {
    // tainted canvas (file://) or image not ready — grid + frame snapping still work
  }
  cache.set(key, out)
  return out
}
