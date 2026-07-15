/**
 * Template matching — "which NewsWell page template best describes this page?"
 *
 * Pure, no DOM, no framework: this is the part worth testing.
 *
 * Approach: area-weighted, kind-aware IoU matching.
 *   1. Normalize both the page's blocks and the template's blocks to fractions
 *      of their own content area, so a template authored against a different
 *      paper still compares.
 *   2. Score every (page block, template slot) pair by IoU × a kind weight.
 *   3. Greedily pair the highest-scoring combinations (blocks per page are
 *      single digits; a Hungarian solve would be more correct in principle but
 *      indistinguishable here and much harder to read).
 *   4. Score = how much of the combined AREA got well matched. Area-weighting
 *      matters: getting the half-page lead right should count for far more than
 *      missing a business-card ad, and an unweighted count would say otherwise.
 *
 * Unmatched blocks on either side pay their full area into the denominator, so
 * "template has 8 ad slots, page has 2" is correctly punished.
 */

const EDITORIAL_FAMILY = new Set(['editorial', 'wild-art', 'what-inside'])

/** Wrong kind should hurt a lot; editorial-vs-wild-art is a near miss. */
export function kindWeight(a, b) {
  if (a === b) return 1
  if (EDITORIAL_FAMILY.has(a) && EDITORIAL_FAMILY.has(b)) return 0.6
  return 0.15
}

const area = (r) => Math.max(0, r.w) * Math.max(0, r.h)

export function iou(a, b) {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
  const union = area(a) + area(b) - inter
  return union > 0 ? inter / union : 0
}

/** Rects → fractions of the content area, so papers/sizes are comparable. */
export const normalize = (blocks, W, H) =>
  blocks.map((b) => ({ kind: b.kind, x: b.x / W, y: b.y / H, w: b.w / W, h: b.h / H }))

/**
 * @returns {{score:number, matched:Array, unmatchedPage:number, unmatchedSlots:number}}
 *   score is 0..1 — the fraction of combined area that matched well.
 */
export function scoreTemplate(pageBlocks, slots) {
  const pairs = []
  for (let i = 0; i < pageBlocks.length; i++) {
    for (let j = 0; j < slots.length; j++) {
      const overlap = iou(pageBlocks[i], slots[j])
      if (overlap <= 0) continue
      pairs.push({ i, j, s: overlap * kindWeight(pageBlocks[i].kind, slots[j].kind), iou: overlap })
    }
  }
  pairs.sort((a, b) => b.s - a.s)

  const usedP = new Set(), usedT = new Set(), matched = []
  for (const p of pairs) {
    if (usedP.has(p.i) || usedT.has(p.j)) continue
    usedP.add(p.i); usedT.add(p.j); matched.push(p)
  }

  let num = 0, den = 0
  for (const m of matched) {
    const w = (area(pageBlocks[m.i]) + area(slots[m.j])) / 2
    num += m.s * w
    den += w
  }
  for (let i = 0; i < pageBlocks.length; i++) if (!usedP.has(i)) den += area(pageBlocks[i])
  for (let j = 0; j < slots.length; j++) if (!usedT.has(j)) den += area(slots[j])

  return {
    score: den > 0 ? num / den : 0,
    matched,
    unmatchedPage: pageBlocks.length - usedP.size,
    unmatchedSlots: slots.length - usedT.size
  }
}

/**
 * Rank a template library against one page.
 * @param pageBlocks blocks as {kind,x,y,w,h} in content points
 * @param templates  PageTemplate[] (blocks in content points, pageWidth/pageHeight)
 * @param content    {w,h} content area of the page being matched
 */
export function rankTemplates(pageBlocks, templates, content) {
  if (!pageBlocks.length || !templates?.length) return []
  const page = normalize(pageBlocks, content.w, content.h)
  return templates
    .map((t) => {
      const slots = normalize(
        (t.blocks || []).map((b) => ({ kind: b.kind, x: b.x, y: b.y, w: b.width, h: b.height })),
        t.pageWidth || content.w,
        t.pageHeight || content.h
      )
      const r = scoreTemplate(page, slots)
      return {
        id: t.id,
        name: t.name,
        type: t.type,
        description: t.description,
        slots: slots.length,
        ...r
      }
    })
    .sort((a, b) => b.score - a.score)
}
