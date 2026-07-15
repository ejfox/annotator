/**
 * Template library source + "page → template" conversion.
 *
 * READ: prefers the live NewsWell Studio library, falls back to the bundled
 * snapshot. Studio already serves CORS `*`, so a browser can reach it directly
 * the moment GET is public.
 *
 * WRITE: deliberately NOT a blind PUT. Studio's PUT /api/templates replaces the
 * ENTIRE library (last-write-wins, whole array) and is auth-gated — firing that
 * from here could wipe the shared library on a race. So `pageToTemplate` just
 * builds a valid PageTemplate; how it travels (download + import, or a future
 * append endpoint) is the caller's choice. See the notes in README.
 */
import { contentSize } from './geometry.js'

export const STUDIO_TEMPLATES_URL = 'https://newskickstudio.com/api/templates'
const BUNDLED = 'newskick-templates-from-bbpress.json'

const rid = () => Math.random().toString(36).slice(2, 10)
const r1 = (v) => Math.round(v * 10) / 10

/** Studio returns {version,updatedAt,updatedBy,templates[]}; the bundled file matches. */
const unwrap = (d) => (Array.isArray(d) ? d : d?.templates || [])

/**
 * @returns {{templates:Array, source:'studio'|'bundled'|'none', error?:string}}
 */
export async function loadTemplates(url = STUDIO_TEMPLATES_URL) {
  if (url) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const t = unwrap(await res.json())
        if (t.length) return { templates: t, source: 'studio' }
      }
      // 401 = library is still auth-gated; fall through to the snapshot
      var why = `studio ${res.status}`
    } catch (e) {
      var why = 'studio unreachable'
    }
  }
  try {
    const t = unwrap(await (await fetch(BUNDLED, { cache: 'no-store' })).json())
    return { templates: t, source: 'bundled', error: why }
  } catch {
    return { templates: [], source: 'none', error: why }
  }
}

/** cover if it has a What's Inside rail; ad if nothing editorial; else ad-editorial. */
export function inferType(blocks) {
  if (blocks.some((b) => b.kind === 'what-inside')) return 'cover'
  if (!blocks.some((b) => b.kind === 'editorial' || b.kind === 'wild-art')) return 'ad'
  return 'ad-editorial'
}

/**
 * Turn the current page's blocks into a NewsWell PageTemplate.
 * Blocks arrive in content points already.
 */
export function pageToTemplate(blocks, { paper, name, description = '', section = '' }) {
  const { w, h } = contentSize(paper)
  const type = inferType(blocks)
  return {
    id: 'annot-' + rid(),
    name,
    type,
    section,
    description,
    pageWidth: w,
    pageHeight: h,
    blocks: blocks.map((b) => {
      const blk = {
        id: rid(),
        kind: b.kind,
        x: r1(b.x),
        y: r1(b.y),
        width: r1(b.w),
        height: r1(b.h)
      }
      if (b.role && b.kind === 'editorial') {
        blk.role = b.role
        blk.requiresPhoto = true
        blk.imageLayout = 'top'
        blk.imageRatio = b.role === 'lead' ? 0.4 : 0.3
      }
      if (b.kind === 'what-inside') blk.whatsInside = { showPageNumbers: true }
      return blk
    }),
    origin: 'ai',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}
