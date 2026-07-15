<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  S, paper, conv, curBoxes, colorOf, labelOf, isSel, boxById, selBoxes,
  candidates, snapTo, setSel, toggleSel, clearSel, snapshot, save, rolesFor
} from '../store.js'
import { clamp, gridXPts, marginYPts } from '../lib/geometry.js'

const stageEl = ref(null)
const canvasEl = ref(null)
const imgEl = ref(null)

/* ---------------- image + fit ---------------- */
const pageSrc = computed(() => S.project?.pages[S.page]?.src || '')
const displaySrc = ref('')
watch(pageSrc, (s) => { S.imgMissing = false; displaySrc.value = s }, { immediate: true })

function blankPage() {
  const w = S.project?.imageW || 1707, h = S.project?.imageH || 1650
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h)
  return c.toDataURL()
}
// Page scans aren't bundled (copyrighted). Fall back to a blank page at the right
// size so grid, blocks, snapping and export all still work.
function onErr() { if (S.imgMissing) return; S.imgMissing = true; displaySrc.value = blankPage() }
function onLoad() {
  const im = imgEl.value
  S.natW = im.naturalWidth || 1
  S.natH = im.naturalHeight || 1
  recalcFit()
}

const fit = ref(1)
const scale = computed(() => fit.value * S.zoom)
function recalcFit() {
  const el = stageEl.value
  if (!el) return
  const pad = 52
  fit.value = Math.min(
    Math.max(60, el.clientWidth - pad) / (S.natW || 1),
    Math.max(60, el.clientHeight - pad) / (S.natH || 1)
  )
}
let ro
onMounted(() => { ro = new ResizeObserver(recalcFit); ro.observe(stageEl.value); recalcFit() })
onBeforeUnmount(() => ro?.disconnect())

function clientToImg(cx, cy) {
  const r = canvasEl.value.getBoundingClientRect()
  return { x: (cx - r.left) / scale.value, y: (cy - r.top) / scale.value }
}
function toImg(ev) {
  const p = clientToImg(ev.clientX, ev.clientY)
  return { x: clamp(p.x, 0, S.natW), y: clamp(p.y, 0, S.natH) }
}
function zoomAt(mult, cx, cy) {
  const before = clientToImg(cx, cy)
  S.zoom = clamp(S.zoom * mult, 0.4, 8)
  requestAnimationFrame(() => {
    const r = canvasEl.value.getBoundingClientRect()
    stageEl.value.scrollLeft += r.left + before.x * scale.value - cx
    stageEl.value.scrollTop += r.top + before.y * scale.value - cy
  })
}
const zoomFit = () => (S.zoom = 1)
function onWheel(e) {
  if (!(e.ctrlKey || e.metaKey)) return
  e.preventDefault()
  zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY)
}

/* ---------------- grid ---------------- */
const gridLines = computed(() => {
  if (!S.grid) return { v: [], h: [] }
  const p = paper.value
  const xs = gridXPts(p, S.gridMode)
  const v = xs.map((pt, i) => ({
    pt, margin: pt === p.marginL || pt === p.pageW - p.marginR,
    band: i % 2 === 0 && i + 1 < xs.length ? xs[i + 1] - pt : 0
  }))
  return { v, h: marginYPts(p) }
})
const gx = (pt) => (pt * S.natW / paper.value.pageW) * scale.value
const gy = (pt) => (pt * S.natH / paper.value.pageH) * scale.value

/* ---------------- interaction ---------------- */
const guide = ref({ x: null, y: null, tx: '', ty: '' })
const hud = ref(null)
const marquee = ref(null)
let drag = null, panning = null

const snapOn = (ev) => S.snap && !ev.shiftKey

function onPointerDown(ev) {
  if (ev.button !== 0) return
  if (S.space) {
    canvasEl.value.setPointerCapture(ev.pointerId)
    panning = { sx: ev.clientX, sy: ev.clientY, l: stageEl.value.scrollLeft, t: stageEl.value.scrollTop }
    return
  }
  ev.preventDefault()
  canvasEl.value.setPointerCapture(ev.pointerId)
  const p = toImg(ev)
  const handle = ev.target.dataset?.handle
  const boxId = ev.target.closest('.box')?.dataset.id

  if (handle && boxId) {
    const b = boxById(+boxId)
    if (!b || b.locked) return
    setSel([b.id], b.id); snapshot()
    drag = { mode: 'resize', handle, box: b, orig: { ...b }, sx: p.x, sy: p.y }
    return
  }
  if (boxId) {
    const id = +boxId, b = boxById(id)
    if (ev.shiftKey) { toggleSel(id); return }
    if (!isSel(id)) setSel([id], id)
    else S.primary = id
    if (b.locked) return
    snapshot()
    drag = { mode: 'move', box: b, origs: selBoxes.value.map((x) => ({ id: x.id, x: x.x, y: x.y, w: x.w, h: x.h })), sx: p.x, sy: p.y }
    return
  }
  if (ev.altKey) {
    drag = { mode: 'marquee', sx: p.x, sy: p.y, add: ev.shiftKey, base: [...S.sel] }
    return
  }
  // draw — snap the start corner too, so frames begin on a line
  snapshot()
  let x0 = p.x, y0 = p.y
  if (snapOn(ev)) {
    const a = snapTo(p.x, candidates('x', new Set(), imgEl.value), scale.value); if (a) x0 = a.v
    const c = snapTo(p.y, candidates('y', new Set(), imgEl.value), scale.value); if (c) y0 = c.v
  }
  const nb = { id: S.uid++, x: x0, y: y0, w: 0, h: 0, cls: S.active }
  const rr = rolesFor(S.active)
  if (rr) nb.role = S.defaultRole[S.active] || rr[0]
  curBoxes.value.push(nb)
  setSel([nb.id], nb.id)
  drag = { mode: 'draw', box: nb, sx: x0, sy: y0 }
}

function onPointerMove(ev) {
  const p0 = toImg(ev)
  S.cursor = { x: Math.round(conv.value.pxToPtX(p0.x)), y: Math.round(conv.value.pxToPtY(p0.y)) }
  if (panning) {
    stageEl.value.scrollLeft = panning.l - (ev.clientX - panning.sx)
    stageEl.value.scrollTop = panning.t - (ev.clientY - panning.sy)
    return
  }
  if (!drag) return
  const p = p0
  const dx = p.x - drag.sx, dy = p.y - drag.sy
  const on = snapOn(ev)
  let gX = null, gY = null, tX = '', tY = ''

  if (drag.mode === 'marquee') {
    marquee.value = { x: Math.min(drag.sx, p.x), y: Math.min(drag.sy, p.y), w: Math.abs(p.x - drag.sx), h: Math.abs(p.y - drag.sy) }
    return
  }
  const b = drag.box
  const excl = new Set(S.sel)

  if (drag.mode === 'draw') {
    let qx = p.x, qy = p.y
    if (on) {
      const a = snapTo(qx, candidates('x', new Set([b.id]), imgEl.value), scale.value); if (a) { qx = a.v; gX = a.v; tX = a.tag }
      const c = snapTo(qy, candidates('y', new Set([b.id]), imgEl.value), scale.value); if (c) { qy = c.v; gY = c.v; tY = c.tag }
    }
    b.x = Math.min(drag.sx, qx); b.y = Math.min(drag.sy, qy)
    b.w = Math.abs(qx - drag.sx); b.h = Math.abs(qy - drag.sy)
    hud.value = { x: b.x, y: b.y, text: `${Math.round(conv.value.pxToPtW(b.w))} × ${Math.round(conv.value.pxToPtH(b.h))} pt` }
  } else if (drag.mode === 'move') {
    let ddx = dx, ddy = dy
    for (const o of drag.origs) {
      ddx = clamp(ddx, -o.x, S.natW - o.w - o.x)
      ddy = clamp(ddy, -o.y, S.natH - o.h - o.y)
    }
    if (on) {
      const pr = drag.origs.find((o) => o.id === S.primary) || drag.origs[0]
      const xC = candidates('x', excl, imgEl.value), yC = candidates('y', excl, imgEl.value)
      const nl = pr.x + ddx, nr = pr.x + pr.w + ddx
      const sL = snapTo(nl, xC, scale.value), sR = snapTo(nr, xC, scale.value)
      if (sL && (!sR || Math.abs(sL.v - nl) <= Math.abs(sR.v - nr))) { ddx += sL.v - nl; gX = sL.v; tX = sL.tag }
      else if (sR) { ddx += sR.v - nr; gX = sR.v; tX = sR.tag }
      for (const o of drag.origs) ddx = clamp(ddx, -o.x, S.natW - o.w - o.x)
      const nt = pr.y + ddy, nbm = pr.y + pr.h + ddy
      const sT = snapTo(nt, yC, scale.value), sB = snapTo(nbm, yC, scale.value)
      if (sT && (!sB || Math.abs(sT.v - nt) <= Math.abs(sB.v - nbm))) { ddy += sT.v - nt; gY = sT.v; tY = sT.tag }
      else if (sB) { ddy += sB.v - nbm; gY = sB.v; tY = sB.tag }
      for (const o of drag.origs) ddy = clamp(ddy, -o.y, S.natH - o.h - o.y)
    }
    for (const o of drag.origs) {
      const bb = boxById(o.id)
      bb.x = o.x + ddx; bb.y = o.y + ddy
    }
    hud.value = { x: b.x, y: b.y, text: `${Math.round(conv.value.pxToPtX(b.x))}, ${Math.round(conv.value.pxToPtY(b.y))} pt` }
  } else if (drag.mode === 'resize') {
    const o = drag.orig, h = drag.handle
    let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h
    if (h.includes('w')) x0 = clamp(o.x + dx, 0, x1 - 6)
    if (h.includes('e')) x1 = clamp(o.x + o.w + dx, x0 + 6, S.natW)
    if (h.includes('n')) y0 = clamp(o.y + dy, 0, y1 - 6)
    if (h.includes('s')) y1 = clamp(o.y + o.h + dy, y0 + 6, S.natH)
    if (on) {
      const xC = candidates('x', excl, imgEl.value), yC = candidates('y', excl, imgEl.value)
      if (h.includes('w')) { const s = snapTo(x0, xC, scale.value); if (s) { x0 = s.v; gX = s.v; tX = s.tag } }
      if (h.includes('e')) { const s = snapTo(x1, xC, scale.value); if (s) { x1 = s.v; gX = s.v; tX = s.tag } }
      if (h.includes('n')) { const s = snapTo(y0, yC, scale.value); if (s) { y0 = s.v; gY = s.v; tY = s.tag } }
      if (h.includes('s')) { const s = snapTo(y1, yC, scale.value); if (s) { y1 = s.v; gY = s.v; tY = s.tag } }
    }
    b.x = x0; b.y = y0; b.w = x1 - x0; b.h = y1 - y0
    hud.value = { x: b.x, y: b.y, text: `${Math.round(conv.value.pxToPtW(b.w))} × ${Math.round(conv.value.pxToPtH(b.h))} pt` }
  }
  guide.value = { x: gX, y: gY, tx: tX, ty: tY }
}

function onPointerUp() {
  if (panning) { panning = null; return }
  if (!drag) return
  if (drag.mode === 'marquee') {
    const r = marquee.value
    if (r) {
      const hit = curBoxes.value.filter((b) => !b.hidden && b.x < r.x + r.w && r.x < b.x + b.w && b.y < r.y + r.h && r.y < b.y + b.h).map((b) => b.id)
      setSel(drag.add ? [...new Set([...drag.base, ...hit])] : hit)
    } else if (!drag.add) clearSel()
    marquee.value = null; drag = null
    return
  }
  const b = drag.box
  if (drag.mode === 'draw' && (b.w < 8 || b.h < 8)) {
    S.boxes[S.page] = curBoxes.value.filter((x) => x.id !== b.id)
    clearSel()
  }
  guide.value = { x: null, y: null, tx: '', ty: '' }
  hud.value = null
  drag = null
  save()
}

/** App drives zoom from the keyboard; the stage element lives here. */
const centerX = () => stageEl.value.getBoundingClientRect().left + stageEl.value.clientWidth / 2
const centerY = () => stageEl.value.getBoundingClientRect().top + stageEl.value.clientHeight / 2
const zoomIn = () => zoomAt(1.2, centerX(), centerY())
const zoomOut = () => zoomAt(1 / 1.2, centerX(), centerY())
defineExpose({ zoomIn, zoomOut, zoomFit })
</script>

<template>
  <main id="stage" ref="stageEl" @wheel="onWheel">
    <div id="stageInner">
      <div
        id="canvas" ref="canvasEl"
        :class="{ pan: S.space }"
        :style="{ width: (S.natW * scale) + 'px' }"
        @pointerdown="onPointerDown" @pointermove="onPointerMove"
        @pointerup="onPointerUp" @pointercancel="onPointerUp"
      >
        <img id="page" ref="imgEl" :src="displaySrc" alt="page" :style="{ width: (S.natW * scale) + 'px' }" @load="onLoad" @error="onErr">

        <div id="noimg" :class="{ on: S.imgMissing }">
          <b>Page image not bundled</b>
          <span>Sample scans aren't committed (copyrighted publication content).<br>
            Use <b>Add pages…</b> to load your own, or see <code>samples/README.md</code>.</span>
        </div>

        <div id="grid" :class="{ on: S.grid }">
          <template v-for="(l, i) in gridLines.v" :key="'v' + i">
            <div v-if="l.band" class="gl v col" :style="{ left: gx(l.pt) + 'px', width: (l.band * S.natW / paper.pageW) * scale + 'px' }"></div>
            <div class="gl v" :class="{ m: l.margin }" :style="{ left: gx(l.pt) + 'px' }"></div>
          </template>
          <div v-for="(pt, i) in gridLines.h" :key="'h' + i" class="gl h m" :style="{ top: gy(pt) + 'px' }"></div>
        </div>

        <div v-for="b in curBoxes" :key="b.id" v-show="!b.hidden"
          class="box" :class="{ sel: isSel(b.id), locked: b.locked, hover: S.hover === b.id }"
          :data-id="b.id"
          :style="{
            left: b.x * scale + 'px', top: b.y * scale + 'px',
            width: b.w * scale + 'px', height: b.h * scale + 'px',
            '--c': colorOf(b.cls), '--cf': colorOf(b.cls) + '2b'
          }">
          <div class="tag">{{ labelOf(b.cls) }}<template v-if="b.role"> · {{ b.role.toUpperCase() }}</template></div>
          <div v-if="b.locked" class="lk">🔒</div>
          <template v-if="S.sel.length === 1 && isSel(b.id) && !b.locked">
            <div v-for="h in ['nw','ne','sw','se','n','s','e','w']" :key="h" class="hnd" :class="h" :data-handle="h"></div>
          </template>
        </div>

        <div id="gx" class="guide" :style="{ display: guide.x != null ? 'block' : 'none', left: (guide.x ?? 0) * scale + 'px' }">
          <span class="glab">{{ guide.tx }}</span>
        </div>
        <div id="gy" class="guide" :style="{ display: guide.y != null ? 'block' : 'none', top: (guide.y ?? 0) * scale + 'px' }">
          <span class="glab">{{ guide.ty }}</span>
        </div>

        <div id="marquee" v-if="marquee" :style="{
          display: 'block', left: marquee.x * scale + 'px', top: marquee.y * scale + 'px',
          width: marquee.w * scale + 'px', height: marquee.h * scale + 'px' }"></div>

        <div id="hud" v-if="hud" :style="{ display: 'block', left: hud.x * scale + 'px', top: (Math.max(hud.y, 0) * scale - 6) + 'px' }">{{ hud.text }}</div>
      </div>
    </div>
    <slot />
    <div id="zoombar">
      <button @click="zoomOut" title="Zoom out (−)">−</button>
      <div id="zoomval" @click="zoomFit" title="Reset to fit (0)">{{ S.zoom === 1 ? 'Fit' : Math.round(S.zoom * 100) + '%' }}</div>
      <button @click="zoomIn" title="Zoom in (+)">+</button>
    </div>
  </main>
</template>
