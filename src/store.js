/**
 * App state + actions.
 *
 * One reactive object and a pile of plain functions. No Pinia — this is a
 * single-view tool and the extra ceremony would earn nothing. The win over the
 * old vanilla build isn't this file, it's what it deletes: nothing here has to
 * remember to call a render function.
 */
import { reactive, computed } from 'vue'
import {
  FALLBACK_PAPERS, clamp, gridXPts, marginYPts, contentSize, converters
} from './lib/geometry.js'
import { detectEdges, clearEdgeCache } from './lib/edges.js'
import { toNewsWell, fromNewsWell } from './lib/newswell.js'
import { rankTemplates } from './lib/templateMatch.js'
import { loadTemplates as fetchTemplates, pageToTemplate } from './lib/templates.js'

const LS_PROJ = 'nwannot.project.v1'
const LS_PREFS = 'nwannot.prefs.v1'

const FALLBACK_TYPES = [
  { id: 'article', label: 'Article', group: 'Editorial', kind: 'editorial', key: 'a', color: '#2563eb', roles: ['secondary', 'lead', 'brief'] },
  { id: 'wild-art', label: 'Wild Art', group: 'Editorial', kind: 'wild-art', key: 'w', color: '#10b981' },
  { id: 'what-inside', label: "What's Inside", group: 'Editorial', kind: 'what-inside', key: 'i', color: '#8b5cf6' },
  { id: 'ad', label: 'Ad', group: 'Ad', kind: 'ad', key: 'd', color: '#e11d48' },
  { id: 'filler', label: 'Filler', group: 'Filler', kind: 'filler', key: 'f', color: '#64748b' }
]

/** Bundled sample. Page scans aren't committed — see public/samples/README.md. */
const SAMPLE = {
  id: 'beach-and-bay-2026-05-08',
  title: 'Beach & Bay Press — May 8 2026',
  source: 'beach-and-bay-press-may-8-2026.pdf',
  paperId: 'newswell-819x792',
  imageW: 1707, imageH: 1650,
  pages: Array.from({ length: 16 }, (_, i) => ({
    name: 'p-' + String(i + 1).padStart(2, '0'),
    src: 'samples/beach-and-bay-press-2026-05-08/pages/p-' + String(i + 1).padStart(2, '0') + '.png'
  })),
  annotations: {
    0: [
      { x: 1261, y: 268, w: 367, h: 744, cls: 'article', role: 'secondary' },
      { x: 365, y: 279, w: 852, h: 733, cls: 'article', role: 'lead' },
      { x: 75, y: 268, w: 281, h: 796, cls: 'what-inside' },
      { x: 75, y: 1096, w: 267, h: 260, cls: 'ad' },
      { x: 75, y: 1356, w: 766, h: 243, cls: 'ad' },
      { x: 866, y: 1356, w: 762, h: 243, cls: 'article', role: 'secondary' },
      { x: 365, y: 1023, w: 476, h: 333, cls: 'article', role: 'secondary' },
      { x: 866, y: 1012, w: 762, h: 344, cls: 'article', role: 'secondary' }
    ]
  }
}

export const S = reactive({
  papers: FALLBACK_PAPERS,
  types: FALLBACK_TYPES,
  issues: [],       // bundled issue manifest (public/issues.json)
  projects: {},     // id -> project; every issue you've touched
  project: null,    // the active one (same object as projects[project.id])
  paperId: 'newswell-819x792',
  page: 0,
  boxes: {},
  pred: {},
  templates: [],
  templateSource: '', // 'studio' | 'bundled' | 'none'
  templateNote: '',
  undo: {},
  redo: {},
  uid: 1,
  sel: [],
  primary: null,
  hover: null,
  clip: [],
  natW: 1707,
  natH: 1650,
  zoom: 1,
  cursor: { x: 0, y: 0 },
  imgMissing: false,
  active: 'article',
  snap: true,
  snapFrames: true, // snap to other blocks' edges — the "snap-to-touch" magnet
  edgesOn: false,
  grid: false,
  gridMode: '4',
  mm: true,
  defaultRole: {},
  space: false,
  saveState: 'idle',
  toast: ''
})

/* ---------------- derived ---------------- */
export const paper = computed(() => S.papers[S.paperId] || FALLBACK_PAPERS['newswell-819x792'])
export const nPages = computed(() => S.project?.pages.length ?? 0)
export const conv = computed(() => converters(paper.value, S.natW, S.natH))
export const curBoxes = computed(() => S.boxes[S.page] || [])
export const selBoxes = computed(() => curBoxes.value.filter((b) => S.sel.includes(b.id)))
const typeMap = computed(() => Object.fromEntries(S.types.map((t) => [t.id, t])))

export const colorOf = (id) => typeMap.value[id]?.color || '#888'
export const labelOf = (id) => (typeMap.value[id]?.label || id || '?').toUpperCase()
export const kindOf = (id) => typeMap.value[id]?.kind || id
export const rolesFor = (id) => typeMap.value[id]?.roles || null
export const boxById = (id) => curBoxes.value.find((b) => b.id === id)
export const isSel = (id) => S.sel.includes(id)

export const coverage = computed(() => {
  const p = paper.value, c = conv.value
  const cx0 = c.ptToPxX(0), cy0 = c.ptToPxY(0)
  const { w: cw, h: ch } = contentSize(p)
  const cx1 = c.ptToPxX(cw), cy1 = c.ptToPxY(ch)
  const area = Math.max(1, (cx1 - cx0) * (cy1 - cy0))
  const bs = curBoxes.value.filter((b) => !b.hidden)
  let covered = 0, overlaps = 0
  for (const b of bs) {
    const ix0 = Math.max(b.x, cx0), iy0 = Math.max(b.y, cy0)
    const ix1 = Math.min(b.x + b.w, cx1), iy1 = Math.min(b.y + b.h, cy1)
    if (ix1 > ix0 && iy1 > iy0) covered += (ix1 - ix0) * (iy1 - iy0)
  }
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], d = bs[j]
      if (a.x < d.x + d.w && d.x < a.x + a.w && a.y < d.y + d.h && d.y < a.y + a.h) overlaps++
    }
  }
  return { pct: Math.min(999, Math.round((covered / area) * 100)), overlaps, count: bs.length }
})

/* ---------------- templates ---------------- */
/** Current page's blocks in NewsWell content points — the shape templates speak. */
export const pageBlocksPt = computed(() => {
  const c = conv.value
  return curBoxes.value.filter((b) => !b.hidden).map((b) => ({
    kind: kindOf(b.cls),
    role: b.role,
    x: c.pxToPtX(b.x), y: c.pxToPtY(b.y), w: c.pxToPtW(b.w), h: c.pxToPtH(b.h)
  }))
})
export const pageMatches = computed(() =>
  rankTemplates(pageBlocksPt.value, S.templates, contentSize(paper.value))
)

export async function loadTemplateLibrary() {
  const { templates, source, error } = await fetchTemplates()
  S.templates = templates
  S.templateSource = source
  S.templateNote = error || ''
}

/** Stamp a template's slots onto the current page, replacing what's there. */
export function applyTemplate(t) {
  const c = conv.value
  snapshot()
  S.boxes[S.page] = (t.blocks || []).map((b) => {
    const type = S.types.find((x) => x.kind === b.kind) || S.types[0]
    const nb = {
      id: S.uid++, cls: type.id,
      x: c.ptToPxX(b.x), y: c.ptToPxY(b.y), w: c.ptToPxW(b.width), h: c.ptToPxH(b.height)
    }
    if (b.role && rolesFor(type.id)) nb.role = b.role
    return nb
  })
  clearSel(); save()
  toast(`Applied ${t.name}`)
}

/** Build a NewsWell PageTemplate from the current page. */
export function currentPageAsTemplate(name, description) {
  return pageToTemplate(pageBlocksPt.value, { paper: paper.value, name, description })
}

/* ---------------- snapping ---------------- */
const staticSnaps = computed(() => {
  const p = paper.value
  const x = gridXPts(p, S.gridMode).map((pt) => ({ v: (pt * S.natW) / p.pageW, tag: pt === p.marginL || pt === p.pageW - p.marginR ? 'margin' : 'col' }))
  const y = marginYPts(p).map((pt) => ({ v: (pt * S.natH) / p.pageH, tag: 'margin' }))
  return { x, y }
})

function edgeSnaps(img) {
  if (!S.edgesOn || !img) return { x: [], y: [] }
  const e = detectEdges(img, S.page + ':' + (S.project?.pages[S.page]?.src || ''))
  return { x: e.x.map((v) => ({ v, tag: 'edge' })), y: e.y.map((v) => ({ v, tag: 'edge' })) }
}

export function candidates(axis, excludeIds, img) {
  const out = staticSnaps.value[axis].concat(edgeSnaps(img)[axis])
  if (!S.snapFrames) return out // grid + margins only — no sticking to neighbours
  for (const b of curBoxes.value) {
    if (excludeIds.has(b.id) || b.hidden) continue
    if (axis === 'x') out.push({ v: b.x, tag: 'frame' }, { v: b.x + b.w, tag: 'frame' })
    else out.push({ v: b.y, tag: 'frame' }, { v: b.y + b.h, tag: 'frame' })
  }
  return out
}

export function snapTo(v, cands, scale) {
  const thr = 10 / scale
  let best = null, bd = thr
  for (const c of cands) {
    const d = Math.abs(c.v - v)
    if (d < bd) { bd = d; best = c }
  }
  return best
}

/* ---------------- history ---------------- */
const normBox = (b) => {
  const o = { x: +b.x || 0, y: +b.y || 0, w: +b.w || 0, h: +b.h || 0, cls: b.cls }
  if (b.role) o.role = b.role
  if (b.locked) o.locked = true
  if (b.hidden) o.hidden = true
  return o
}
export function snapshot() {
  ;(S.undo[S.page] ||= []).push(JSON.stringify(curBoxes.value.map(normBox)))
  if (S.undo[S.page].length > 80) S.undo[S.page].shift()
  S.redo[S.page] = []
}
const restore = (str) => {
  S.boxes[S.page] = JSON.parse(str).map((b) => ({ id: S.uid++, ...b }))
  clearSel()
}
export function undo() {
  const u = S.undo[S.page]
  if (!u?.length) return
  ;(S.redo[S.page] ||= []).push(JSON.stringify(curBoxes.value.map(normBox)))
  restore(u.pop()); save()
}
export function redo() {
  const r = S.redo[S.page]
  if (!r?.length) return
  ;(S.undo[S.page] ||= []).push(JSON.stringify(curBoxes.value.map(normBox)))
  restore(r.pop()); save()
}

/* ---------------- selection + ops ---------------- */
export function setSel(ids, primary) {
  S.sel = [...ids]
  S.primary = primary ?? ids[ids.length - 1] ?? null
}
export function toggleSel(id) {
  const i = S.sel.indexOf(id)
  if (i >= 0) { S.sel.splice(i, 1); if (S.primary === id) S.primary = S.sel[S.sel.length - 1] ?? null }
  else { S.sel.push(id); S.primary = id }
}
export const clearSel = () => { S.sel = []; S.primary = null }

export function setClass(c) {
  if (!c) return
  S.active = c
  const sel = selBoxes.value
  if (!sel.length) return
  snapshot()
  for (const b of sel) {
    if (b.cls === c) continue
    b.cls = c
    const rr = rolesFor(c)
    if (rr) { if (!b.role) b.role = S.defaultRole[c] || rr[0] }
    else delete b.role
  }
  save()
}
export function deleteSel() {
  if (!S.sel.length) return
  snapshot()
  S.boxes[S.page] = curBoxes.value.filter((b) => !isSel(b.id) || b.locked)
  clearSel(); save()
}
export const copySel = () => {
  S.clip = selBoxes.value.map(normBox)
  if (S.clip.length) toast(S.clip.length + ' copied')
}
export function paste(offset) {
  if (!S.clip.length) return
  snapshot()
  const off = offset ? conv.value.ptToPxW(12) : 0
  const ids = []
  for (const c of S.clip) {
    const nb = { id: S.uid++, ...normBox(c), x: clamp(c.x + off, 0, S.natW - c.w), y: clamp(c.y + off, 0, S.natH - c.h) }
    delete nb.locked; delete nb.hidden
    curBoxes.value.push(nb); ids.push(nb.id)
  }
  setSel(ids); save()
}
export const duplicate = () => { if (S.sel.length) { copySel(); paste(true) } }

export function align(op) {
  const bs = selBoxes.value
  if (bs.length < 2) return
  snapshot()
  const L = Math.min(...bs.map((b) => b.x)), R = Math.max(...bs.map((b) => b.x + b.w))
  const T = Math.min(...bs.map((b) => b.y)), B = Math.max(...bs.map((b) => b.y + b.h))
  if (op === 'l') bs.forEach((b) => (b.x = L))
  else if (op === 'r') bs.forEach((b) => (b.x = R - b.w))
  else if (op === 'ch') bs.forEach((b) => (b.x = (L + R) / 2 - b.w / 2))
  else if (op === 't') bs.forEach((b) => (b.y = T))
  else if (op === 'b') bs.forEach((b) => (b.y = B - b.h))
  else if (op === 'cv') bs.forEach((b) => (b.y = (T + B) / 2 - b.h / 2))
  else if (op === 'dh') {
    const s = [...bs].sort((a, c) => a.x - c.x)
    const gap = (R - L - s.reduce((n, b) => n + b.w, 0)) / (s.length - 1)
    let x = L; s.forEach((b) => { b.x = x; x += b.w + gap })
  } else if (op === 'dv') {
    const s = [...bs].sort((a, c) => a.y - c.y)
    const gap = (B - T - s.reduce((n, b) => n + b.h, 0)) / (s.length - 1)
    let y = T; s.forEach((b) => { b.y = y; y += b.h + gap })
  }
  save()
}
export function nudge(dx, dy) {
  const bs = selBoxes.value
  if (!bs.length) return
  snapshot()
  for (const b of bs) {
    if (b.locked) continue
    b.x = clamp(b.x + dx, 0, S.natW - b.w)
    b.y = clamp(b.y + dy, 0, S.natH - b.h)
  }
  save()
}
export function zorder(b, dir) {
  snapshot()
  const arr = S.boxes[S.page]
  arr.splice(arr.indexOf(b), 1)
  dir > 0 ? arr.push(b) : arr.unshift(b)
  save()
}

/* ---------------- toast ---------------- */
let toastT = null
export function toast(msg) {
  S.toast = msg
  clearTimeout(toastT)
  toastT = setTimeout(() => (S.toast = ''), 1700)
}

/* ---------------- persistence ---------------- */
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(LS_PREFS) || '{}')
    for (const k of ['snap', 'snapFrames', 'edgesOn', 'grid', 'mm']) if (p[k] != null) S[k] = p[k]
    if (p.gridMode) S.gridMode = p.gridMode
    if (p.defaultRole) S.defaultRole = p.defaultRole
  } catch {}
}
export function savePrefs() {
  try {
    localStorage.setItem(LS_PREFS, JSON.stringify({
      snap: S.snap, snapFrames: S.snapFrames, edgesOn: S.edgesOn, grid: S.grid,
      gridMode: S.gridMode, mm: S.mm, defaultRole: S.defaultRole
    }))
  } catch {}
}

const collect = () => {
  const a = {}
  for (let i = 0; i < nPages.value; i++) a[i] = (S.boxes[i] || []).map(normBox)
  return a
}
export function persist() {
  if (!S.project) return
  S.project.paperId = S.paperId
  S.project.annotations = collect()
  // v2: every issue you've touched, not just the active one
  const payload = JSON.stringify({ v: 2, current: S.project.id, projects: S.projects })
  try { localStorage.setItem(LS_PROJ, payload); S.saveState = 'ok' }
  catch { S.saveState = 'err'; toast('Save failed — storage full? Export your JSON.') }
  fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }).catch(() => {})
}
let saveT = null
export function save() {
  S.saveState = 'dirty'
  clearTimeout(saveT)
  saveT = setTimeout(persist, 300)
}

/* ---------------- predictions ---------------- */
/** Predictions are per-issue: { predictions: { issueId: { pageIdx: [...] } } } */
export async function loadPredictions() {
  S.pred = {}
  if (!S.project) return
  try {
    const p = await (await fetch('predictions.json', { cache: 'no-store' })).json()
    const forIssue = p.predictions?.[S.project.id] || {}
    for (const k in forIssue) {
      S.pred[+k] = forIssue[k].map((b) => ({ cls: b.cls, x: b.x, y: b.y, w: b.w, h: b.h, role: b.role }))
    }
  } catch {}
}
/** Fill empty pages that have a prediction. Returns how many pages were filled. */
export function seedPredictions({ once = true } = {}) {
  if (!S.project) return 0
  const seeded = (S.project.seeded ||= {})
  let n = 0
  for (let i = 0; i < nPages.value; i++) {
    if ((S.boxes[i] || []).length) continue
    if (once && seeded[i]) continue
    const pr = S.pred[i]
    if (!pr?.length) continue
    S.boxes[i] = pr.map((b) => {
      const cls = typeMap.value[b.cls] ? b.cls : S.types[0].id
      const nb = { id: S.uid++, x: b.x, y: b.y, w: b.w, h: b.h, cls }
      if (b.role && rolesFor(cls)) nb.role = b.role
      return nb
    })
    seeded[i] = true
    n++
  }
  return n
}
export function applyPrediction() {
  const a = S.pred[S.page]
  if (!a?.length) return toast('No AI blocks for this page yet')
  snapshot()
  for (const b of a) {
    const cls = typeMap.value[b.cls] ? b.cls : S.types[0].id
    const nb = { id: S.uid++, x: b.x, y: b.y, w: b.w, h: b.h, cls }
    if (b.role && rolesFor(cls)) nb.role = b.role
    curBoxes.value.push(nb)
  }
  clearSel(); save()
  toast(`AI first pass: ${a.length} blocks — tune away`)
}

/* ---------------- project ---------------- */
export function loadProject(pr) {
  S.project = pr
  S.paperId = pr.paperId in S.papers ? pr.paperId : Object.keys(S.papers)[0]
  if (!paper.value.grids[S.gridMode]) S.gridMode = paper.value.defaultGrid || Object.keys(paper.value.grids)[0]
  S.boxes = {}; S.undo = {}; S.redo = {}
  clearEdgeCache()
  for (let i = 0; i < pr.pages.length; i++) {
    const src = pr.annotations?.[i] || pr.annotations?.[String(i)] || []
    S.boxes[i] = src.map((b) => ({ id: S.uid++, ...normBox(b) }))
  }
  S.page = 0
  clearSel()
}

export function exportJson() {
  return toNewsWell({
    paper: paper.value, paperId: S.paperId, gridMode: S.gridMode, project: S.project,
    boxes: S.boxes, nPages: nPages.value, natW: S.natW, natH: S.natH, kindOf
  })
}
export function importJson(obj) {
  const res = fromNewsWell(obj, { paper: paper.value, natW: S.natW, natH: S.natH, types: S.types, nPages: nPages.value })
  if (!res) return toast('Unrecognized JSON format')
  for (const i in res) S.boxes[i] = res[i].map((b) => ({ id: S.uid++, ...b }))
  clearSel(); save()
  toast('Imported NewsWell JSON')
}

/** Build an empty project from a manifest entry. Pages are URL refs, not blobs. */
function projectFromIssue(iss) {
  const pad = (i) => 'p-' + String(i + 1).padStart(2, '0')
  const p = {
    id: iss.id, title: iss.title, source: iss.source, paperId: iss.paperId,
    imageW: iss.imageW, imageH: iss.imageH,
    pages: Array.from({ length: iss.pages }, (_, i) => ({ name: pad(i), src: iss.dir + pad(i) + '.png' })),
    annotations: {}, seeded: {}
  }
  // The May 8 issue ships with EJ's hand annotation of page 1 — the seed the
  // whole flywheel started from. Don't hand a fresh clone an empty cover.
  if (iss.id === SAMPLE.id) p.annotations = JSON.parse(JSON.stringify(SAMPLE.annotations))
  return p
}

/** Load a project's boxes + its predictions, and auto-seed anything empty. */
async function activate(id) {
  const pr = S.projects[id]
  if (!pr) return
  loadProject(pr)
  await loadPredictions()
  if (seedPredictions()) persist()
}

export async function switchProject(id) {
  if (!S.projects[id] || id === S.project?.id) return
  persist() // don't lose the issue we're leaving
  await activate(id)
  toast(S.projects[id].title)
}

/** Register a project built from uploaded images and switch to it. */
export async function addProject(pr) {
  if (S.project) persist()
  S.projects[pr.id] = pr
  await activate(pr.id)
  persist()
}

export async function boot() {
  loadPrefs()
  try {
    const p = await (await fetch('papers.json', { cache: 'no-store' })).json()
    if (p?.papers) S.papers = p.papers
  } catch {}
  try {
    const t = await (await fetch('types.json', { cache: 'no-store' })).json()
    if (t?.types?.length) S.types = t.types
  } catch {}
  S.active = S.types[0].id
  loadTemplateLibrary() // non-blocking — matching lights up when it lands
  try {
    const j = await (await fetch('issues.json', { cache: 'no-store' })).json()
    S.issues = j.issues || []
  } catch {}

  // disk (dev server) is the source of truth when it's there — one state across
  // every tab and profile. Falls back to localStorage for the static deploy.
  let stored = null
  try {
    const d = await (await fetch('/api/load', { cache: 'no-store' })).json()
    if (d?.projects || d?.pages) stored = d
  } catch {}
  if (!stored) { try { const raw = localStorage.getItem(LS_PROJ); if (raw) stored = JSON.parse(raw) } catch {} }

  // v1 stored a single bare project. Wrap it rather than drop it — that's
  // somebody's annotation work.
  if (stored?.pages && !stored.projects) {
    stored = { v: 2, current: stored.id, projects: { [stored.id]: stored } }
  }
  S.projects = stored?.projects || {}
  // merge the manifest: issues never opened get an empty project
  for (const iss of S.issues) if (!S.projects[iss.id]) S.projects[iss.id] = projectFromIssue(iss)
  if (!Object.keys(S.projects).length) S.projects[SAMPLE.id] = JSON.parse(JSON.stringify(SAMPLE))

  const first = stored?.current && S.projects[stored.current] ? stored.current : Object.keys(S.projects)[0]
  await activate(first)
  persist()
}

export { SAMPLE }
