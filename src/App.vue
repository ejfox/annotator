<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  S, paper, nPages, conv, curBoxes, colorOf, labelOf,
  boot, save, persist, loadProject, loadPredictions, seedPredictions, switchProject, addProject,
  exportJson, importJson, undo, redo, duplicate, copySel, paste, deleteSel,
  setClass, setSel, clearSel, nudge, savePrefs, toast, SAMPLE
} from './store.js'
import { clearEdgeCache } from './lib/edges.js'
import { pageKey } from './lib/newswell.js'
import LeftRail from './components/LeftRail.vue'
import PageCanvas from './components/PageCanvas.vue'
import RightPanel from './components/RightPanel.vue'
import Minimap from './components/Minimap.vue'
import StatusBar from './components/StatusBar.vue'

const canvas = ref(null)
const help = ref(false)
const menu = ref(false)
const fileImgs = ref(null)
const fileJson = ref(null)
let imgsMode = 'new'

onMounted(async () => { await boot(); poll() })

/* ---------------- pages ---------------- */
function go(n) {
  const t = Math.max(0, Math.min(nPages.value - 1, n))
  if (t === S.page) return
  persist(); S.page = t; clearSel()
}

/* ---------------- predictions hot-apply ----------------
 * Vite's HMR covers modules; predictions.json is runtime data it can't see, so
 * publishing a page still needs a poll to land in an open tab. */
let ver = null, pollT = null
async function poll() {
  try {
    const v = await (await fetch('/api/version', { cache: 'no-store' })).json()
    if (ver !== null && v.pred !== ver) {
      await loadPredictions()
      const n = seedPredictions()
      if (n) { persist(); toast(`✨ auto-filled ${n} page${n > 1 ? 's' : ''}`) }
    }
    ver = v.pred
  } catch { return } // static deploy — endpoint absent, stop
  pollT = setTimeout(poll, 1200)
}
onBeforeUnmount(() => clearTimeout(pollT))

/* ---------------- files ---------------- */
function download(name, text) {
  const b = new Blob([text], { type: 'application/json' })
  const u = URL.createObjectURL(b)
  const a = document.createElement('a')
  a.href = u; a.download = name; a.click()
  URL.revokeObjectURL(u)
}
const doExport = () => download((S.project?.id || 'annotations') + '.newswell.json', JSON.stringify(exportJson(), null, 2))

function pickImgs(mode) { imgsMode = mode; fileImgs.value.click() }
function onImgs(e) {
  const list = [...e.target.files].filter((f) => f.type.startsWith('image/'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  e.target.value = ''
  if (!list.length) return toast('No image files')
  const append = imgsMode === 'append'
  const pages = append ? [...S.project.pages] : []
  const start = pages.length
  let done = 0
  list.forEach((f, k) => {
    const rd = new FileReader()
    rd.onload = () => {
      pages[start + k] = { name: f.name.replace(/\.[^.]+$/, ''), src: rd.result }
      if (++done !== list.length) return
      const keep = append ? JSON.parse(JSON.stringify(S.project.annotations || {})) : {}
      const pr = append
        ? { ...S.project, pages, annotations: keep }
        : {
            id: 'proj-' + Math.random().toString(36).slice(2, 8), title: 'Untitled project',
            source: '', paperId: S.paperId, pages, annotations: {}, seeded: {}
          }
      addProject(pr)
      toast(`${append ? 'Added ' : 'New project · '}${list.length} page${list.length > 1 ? 's' : ''}`)
    }
    rd.readAsDataURL(f)
  })
}
function onJson(e) {
  const f = e.target.files[0]
  e.target.value = ''
  if (!f) return
  const rd = new FileReader()
  rd.onload = () => { try { importJson(JSON.parse(rd.result)); menu.value = false } catch { toast('Bad JSON') } }
  rd.readAsText(f)
}

/* Burn the current page's frames onto the scan and download it. */
function renderOverlay() {
  const img = document.querySelector('#page')
  const c = document.createElement('canvas')
  c.width = S.natW; c.height = S.natH
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0, S.natW, S.natH)
  const bw = Math.max(4, S.natW / 240)
  const sorted = [...curBoxes.value].filter((b) => !b.hidden).sort((a, b) => b.w * b.h - a.w * a.h)
  for (const b of sorted) { ctx.fillStyle = colorOf(b.cls) + '38'; ctx.fillRect(b.x, b.y, b.w, b.h) }
  for (const b of sorted) {
    ctx.strokeStyle = colorOf(b.cls); ctx.lineWidth = bw
    ctx.strokeRect(b.x + bw / 2, b.y + bw / 2, b.w - bw, b.h - bw)
    const tag = labelOf(b.cls) + (b.role ? ' · ' + b.role.toUpperCase() : '')
    const size = Math.max(20, S.natW / 54)
    ctx.font = `bold ${size}px sans-serif`
    ctx.fillStyle = colorOf(b.cls)
    ctx.fillRect(b.x, b.y, ctx.measureText(tag).width + 18, size + 12)
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'top'
    ctx.fillText(tag, b.x + 9, b.y + 6)
  }
  c.toBlob((bl) => {
    const u = URL.createObjectURL(bl)
    const a = document.createElement('a')
    a.href = u; a.download = pageKey(S.page) + '-overlay.png'; a.click()
    URL.revokeObjectURL(u)
  })
  menu.value = false
}
function resetSample() {
  if (!confirm('Reset to the Beach & Bay sample? Your current project stays in its exported files only.')) return
  localStorage.removeItem('nwannot.project.v1')
  loadProject(JSON.parse(JSON.stringify(SAMPLE)))
  seedPredictions()
  persist(); menu.value = false
}

/* ---------------- keyboard ---------------- */
const byKey = computed(() => Object.fromEntries(S.types.filter((t) => t.key).map((t) => [t.key.toLowerCase(), t.id])))
const keyRows = computed(() => [
  ...S.types.filter((t) => t.key).map((t) => [t.key.toUpperCase(), t.label]),
  ['G', 'Toggle grid'], ['C', 'Cycle grid columns'], ['S', 'Toggle snapping'], ['M', 'Toggle minimap'],
  ['Shift-drag', 'Bypass snap'], ['Alt-drag', 'Marquee select'], ['⌘/Ctrl A', 'Select all'],
  ['⌘/Ctrl D', 'Duplicate'], ['⌘/Ctrl C / V', 'Copy / paste'], ['⇧⌘V', 'Paste in place'],
  ['⌘/Ctrl Z', 'Undo'], ['⇧⌘Z', 'Redo'], ['Arrows', 'Nudge 1pt (⇧ = 10pt)'],
  ['Del / ⌫', 'Delete selection'], [', .  or  [ ]', 'Prev / next page'], ['+ / − / 0', 'Zoom in / out / fit'],
  ['Space-drag', 'Pan'], ['Esc', 'Deselect']
])

function onKeyDown(e) {
  const typing = e.target.matches?.('input,select,textarea')
  if (e.key === 'Escape') {
    if (help.value) return (help.value = false)
    if (menu.value) return (menu.value = false)
    if (typing) return e.target.blur()
    return clearSel()
  }
  if (typing) return
  const meta = e.metaKey || e.ctrlKey
  const k = e.key.toLowerCase()
  if (k === ' ') { if (!S.space) S.space = true; e.preventDefault(); return }
  if (meta) {
    if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
    else if (k === 'a') { e.preventDefault(); setSel(curBoxes.value.filter((b) => !b.hidden).map((b) => b.id)) }
    else if (k === 'd') { e.preventDefault(); duplicate() }
    else if (k === 'c') { e.preventDefault(); copySel() }
    else if (k === 'v') { e.preventDefault(); paste(!e.shiftKey) }
    return
  }
  const c = conv.value
  if (k === 'g') { S.grid = !S.grid; savePrefs() }
  else if (k === 's') { S.snap = !S.snap; savePrefs() }
  else if (k === 'm') { S.mm = !S.mm; savePrefs() }
  else if (k === 'c') { const ks = Object.keys(paper.value.grids); S.gridMode = ks[(ks.indexOf(S.gridMode) + 1) % ks.length]; S.grid = true; savePrefs() }
  else if (byKey.value[k]) setClass(byKey.value[k])
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel() }
  else if (k === ',' || k === '[') go(S.page - 1)
  else if (k === '.' || k === ']') go(S.page + 1)
  else if (k === 'arrowleft' && S.sel.length) { e.preventDefault(); nudge(-c.ptToPxW(e.shiftKey ? 10 : 1), 0) }
  else if (k === 'arrowright' && S.sel.length) { e.preventDefault(); nudge(c.ptToPxW(e.shiftKey ? 10 : 1), 0) }
  else if (k === 'arrowup' && S.sel.length) { e.preventDefault(); nudge(0, -c.ptToPxH(e.shiftKey ? 10 : 1)) }
  else if (k === 'arrowdown' && S.sel.length) { e.preventDefault(); nudge(0, c.ptToPxH(e.shiftKey ? 10 : 1)) }
  else if (k === '+' || k === '=') canvas.value?.zoomIn()
  else if (k === '-' || k === '_') canvas.value?.zoomOut()
  else if (k === '0') canvas.value?.zoomFit()
  else if (k === '?' || k === '/') help.value = true
}
const onKeyUp = (e) => { if (e.key === ' ') S.space = false }
onMounted(() => { addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp) })
onBeforeUnmount(() => { removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp) })

function changePaper(e) {
  S.paperId = e.target.value
  if (!paper.value.grids[S.gridMode]) S.gridMode = paper.value.defaultGrid || Object.keys(paper.value.grids)[0]
  clearEdgeCache(); save()
}
</script>

<template>
  <header>
    <div class="brand">
      <div class="mark"></div>
      <div><b>NewsWell Annotator</b><small>NewsKick Studio</small></div>
    </div>
    <div class="sep"></div>
    <div class="grp">
      <select id="issueSel" :value="S.project?.id" title="Switch issue" @change="switchProject($event.target.value)">
        <option v-for="(p, id) in S.projects" :key="id" :value="id">{{ p.title }} · {{ p.pages.length }}pp</option>
      </select>
      <select id="paperSel" :value="S.paperId" title="NewsWell paper preset (page size &amp; grid)" @change="changePaper">
        <option v-for="(p, id) in S.papers" :key="id" :value="id">{{ p.label }}</option>
      </select>
    </div>
    <div class="sep"></div>
    <div class="grp nav">
      <button class="icon ghost" title="Previous page (, or [)" @click="go(S.page - 1)">‹</button>
      <b>{{ S.page + 1 }} / {{ nPages }}</b>
      <button class="icon ghost" title="Next page (. or ])" @click="go(S.page + 1)">›</button>
    </div>
    <div class="spacer"></div>
    <div class="grp">
      <button class="ghost" title="Start a new project from page images" @click="pickImgs('new')">New…</button>
      <button class="ghost" title="Add page images (PNG/JPG)" @click="pickImgs('append')">Add pages…</button>
      <button class="primary" title="Export NewsWell block JSON" @click="doExport">Export JSON</button>
      <button class="icon ghost" title="More" @click="menu = true">⋯</button>
      <button class="icon ghost" title="Keyboard shortcuts (?)" @click="help = true">?</button>
    </div>
    <input ref="fileImgs" type="file" accept="image/*" multiple hidden @change="onImgs">
    <input ref="fileJson" type="file" accept="application/json,.json" hidden @change="onJson">
  </header>

  <div id="body">
    <LeftRail />
    <PageCanvas ref="canvas"><Minimap /></PageCanvas>
    <RightPanel />
  </div>

  <StatusBar />

  <div class="overlay" :class="{ on: help }" @click.self="help = false">
    <div class="card" style="position:relative">
      <button class="close ghost icon" @click="help = false">✕</button>
      <header><h2>Keyboard &amp; mouse</h2></header>
      <div class="body">
        <div class="hint">Drag empty space to draw · click a frame to select · drag body or handles to move &amp; resize.</div>
        <div class="keys">
          <div v-for="([k, v]) in keyRows" :key="k + v"><span>{{ v }}</span><kbd>{{ k }}</kbd></div>
        </div>
      </div>
    </div>
  </div>

  <div class="overlay" :class="{ on: menu }" @click.self="menu = false">
    <div class="card" style="position:relative;max-width:420px">
      <button class="close ghost icon" @click="menu = false">✕</button>
      <header><h2>Project</h2></header>
      <div class="body">
        <div class="row"><button class="grow ghost" @click="renderOverlay">Render overlays → PNG (this page)</button></div>
        <div class="row"><button class="grow ghost" @click="fileJson.click()">Import block JSON…</button></div>
        <div class="row"><button class="grow ghost" @click="download((S.project?.id || 'project') + '.project.json', JSON.stringify(S.project, null, 2)); menu = false">Duplicate project</button></div>
        <div class="row"><button class="grow ghost" @click="resetSample">Reset to Beach &amp; Bay sample</button></div>
        <div class="hint" v-if="S.project">Project: {{ S.project.title }} · {{ nPages }} pages · paper {{ S.paperId }}</div>
      </div>
    </div>
  </div>

  <div class="toast" :class="{ on: !!S.toast }">{{ S.toast }}</div>
</template>
