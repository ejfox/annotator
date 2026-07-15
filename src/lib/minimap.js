/**
 * Minimap page schematic — deliberately black and white.
 *
 * Block kind reads by MARK, not colour: solid = ad, ruled = editorial,
 * hatched = filler, X = wild art. At 46px a colour swatch is just a smudge;
 * a mark still reads.
 */
export function drawMini(canvas, boxes, { natW, natH, kindOf }) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width / 2
  const H = canvas.height / 2
  ctx.setTransform(2, 0, 0, 2, 0, 0)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  const sx = W / (natW || 1707)
  const sy = H / (natH || 1650)

  for (const b of boxes) {
    const x = b.x * sx, y = b.y * sy
    const w = Math.max(1.5, b.w * sx), h = Math.max(1.5, b.h * sy)
    const k = kindOf(b.cls)
    ctx.save()
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
    if (k === 'ad') {
      ctx.fillStyle = '#000'
      ctx.fillRect(x, y, w, h)
    } else if (k === 'filler') {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5
      for (let d = -h; d < w; d += 2.5) {
        ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke()
      }
    } else if (k === 'wild-art') {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(x, y); ctx.lineTo(x + w, y + h)
      ctx.moveTo(x + w, y); ctx.lineTo(x, y + h)
      ctx.stroke()
    } else {
      ctx.fillStyle = '#000'
      if (k === 'what-inside') ctx.fillRect(x, y, w, Math.min(2, h))
      for (let yy = y + 2.5; yy < y + h - 1; yy += 2.5) {
        ctx.fillRect(x + 1, yy, Math.max(1, w - 2), 0.7)
      }
    }
    ctx.restore()
    ctx.strokeStyle = '#000'; ctx.lineWidth = 0.6
    ctx.strokeRect(x + 0.3, y + 0.3, w - 0.6, h - 0.6)
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}
