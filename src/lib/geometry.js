/**
 * Page geometry. Everything here is pure — no framework, no DOM — because the
 * point math is the part that has to stay correct across rewrites.
 *
 * Two coordinate spaces:
 *   image px  — what we store internally; matches the page scan
 *   content pt — what NewsWell speaks; origin = top-left INSIDE the margins
 */

export const FALLBACK_PAPERS = {
  'newswell-819x792': {
    label: 'NewsWell Tab (819 × 792)',
    pageW: 819, pageH: 792,
    marginL: 36, marginR: 36, marginT: 43, marginB: 36,
    baseline: 12, defaultGrid: '4',
    grids: {
      4: { label: '4-col', columns: 4, colWidthPts: 177.75, gutterPts: 12 },
      10: { label: '10-col', columns: 10, colWidthPts: 63.9, gutterPts: 12 }
    }
  }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const r1 = (v) => Math.round(v * 10) / 10

export function gridDef(paper, mode) {
  return paper.grids[mode] || paper.grids[Object.keys(paper.grids)[0]]
}

/** Column left/right edges in full-page points, left margin outward. */
export function gridXPts(paper, mode) {
  const g = gridDef(paper, mode)
  const xs = []
  let x = paper.marginL
  for (let i = 0; i < g.columns; i++) {
    xs.push(Math.round(x * 100) / 100); x += g.colWidthPts
    xs.push(Math.round(x * 100) / 100); x += g.gutterPts
  }
  return xs
}

export const marginYPts = (paper) => [paper.marginT, paper.pageH - paper.marginB]

/** Content area size in points (747 × 713 for the NewsWell tab). */
export const contentSize = (paper) => ({
  w: paper.pageW - paper.marginL - paper.marginR,
  h: paper.pageH - paper.marginT - paper.marginB
})

/**
 * Converters between stored image px and NewsWell content-relative points.
 * Bound to a paper + the natural size of the page image.
 */
export function converters(paper, natW, natH) {
  const kx = paper.pageW / natW
  const ky = paper.pageH / natH
  return {
    pxToPtX: (px) => px * kx - paper.marginL,
    pxToPtY: (py) => py * ky - paper.marginT,
    pxToPtW: (w) => w * kx,
    pxToPtH: (h) => h * ky,
    ptToPxX: (pt) => (pt + paper.marginL) / kx,
    ptToPxY: (pt) => (pt + paper.marginT) / ky,
    ptToPxW: (pt) => pt / kx,
    ptToPxH: (pt) => pt / ky
  }
}
