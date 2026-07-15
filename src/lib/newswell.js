/**
 * NewsWell block JSON — the whole point of the tool.
 *
 * Blocks are emitted in POINTS, content-relative (origin = top-left inside the
 * margins), matching `TemplateBlock` in newswell-studio. Keep this in step with
 * that type; it's the contract between the two apps.
 */
import { r1, contentSize, gridDef } from './geometry.js'

export const pageKey = (n) => 'p-' + String(n + 1).padStart(2, '0')
const nwId = () => Math.random().toString(36).slice(2, 10)

export function toNewsWell({ paper, paperId, gridMode, project, boxes, nPages, natW, natH, kindOf }) {
  const { w: cW, h: cH } = contentSize(paper)
  const g = gridDef(paper, gridMode)
  const sx = paper.pageW / natW
  const sy = paper.pageH / natH
  const out = {
    kind: 'newswell-block-annotations',
    schemaVersion: 1,
    source: project?.source || project?.title || '',
    paper: paperId,
    pageWidth: cW,
    pageHeight: cH,
    gridColumns: Array(g.columns).fill(g.colWidthPts),
    gutterPts: g.gutterPts,
    pages: {}
  }
  for (let i = 0; i < nPages; i++) {
    out.pages[pageKey(i)] = {
      blocks: (boxes[i] || []).map((b) => {
        const kind = kindOf(b.cls)
        const blk = {
          id: nwId(),
          kind,
          x: r1(b.x * sx - paper.marginL),
          y: r1(b.y * sy - paper.marginT),
          width: r1(b.w * sx),
          height: r1(b.h * sy)
        }
        if (b.role && kind === 'editorial') blk.role = b.role
        if (kind === 'what-inside') blk.whatsInside = { showPageNumbers: true }
        return blk
      })
    }
  }
  return out
}

/** Inverse — accepts our own export back. Returns { pageIndex: box[] } or null. */
export function fromNewsWell(obj, { paper, natW, natH, types, nPages }) {
  if (!obj || obj.kind !== 'newswell-block-annotations' || !obj.pages) return null
  const sx = natW / paper.pageW
  const sy = natH / paper.pageH
  const res = {}
  for (let i = 0; i < nPages; i++) {
    const pg = obj.pages[pageKey(i)]
    if (!pg) continue
    res[i] = (pg.blocks || []).map((bl) => {
      const t = types.find((t) => t.kind === bl.kind)
      const b = {
        cls: t ? t.id : 'article',
        x: (bl.x + paper.marginL) * sx,
        y: (bl.y + paper.marginT) * sy,
        w: bl.width * sx,
        h: bl.height * sy
      }
      if (bl.role) b.role = bl.role
      return b
    })
  }
  return res
}
