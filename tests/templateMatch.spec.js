/**
 * Template matching guard.
 *
 * The headline claim of this repo is that six archetypes describe a whole
 * newspaper, and that a matcher can pick the right one back out. That was
 * verified once, by hand, in a throwaway script — which is worth approximately
 * nothing the moment anyone touches the scoring. So it lives here now.
 *
 * The fixtures are committed files, not local state:
 *   - page 1  ← samples/.../annotations.seed.json  (EJ's hand annotation)
 *   - pages 2-16 ← public/predictions.json          (incl. his tuned p2 + p4)
 *   - library ← public/newskick-templates-from-bbpress.json
 *
 * Ground truth is learning/template-provenance.md: each template was distilled
 * FROM specific pages, so the matcher must pick those pages' template back out.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rankTemplates, iou, kindWeight, normalize } from '../src/lib/templateMatch.js'
import { pageToTemplate, inferType } from '../src/lib/templates.js'
import { converters, FALLBACK_PAPERS, contentSize } from '../src/lib/geometry.js'

const R = (p) => JSON.parse(readFileSync(resolve(import.meta.dirname, '..', p), 'utf8'))

const PAPER = FALLBACK_PAPERS['newswell-819x792']
const CONTENT = contentSize(PAPER)
const NAT = { w: 1707, h: 1650 }
const c = converters(PAPER, NAT.w, NAT.h)
const KIND = { article: 'editorial', 'wild-art': 'wild-art', 'what-inside': 'what-inside', ad: 'ad', filler: 'filler' }
const toPt = (b) => ({
  kind: KIND[b.cls] || b.cls, role: b.role,
  x: c.pxToPtX(b.x), y: c.pxToPtY(b.y), w: c.pxToPtW(b.w), h: c.pxToPtH(b.h)
})

const seed = R('public/samples/beach-and-bay-press-2026-05-08/annotations.seed.json')
const preds = R('public/predictions.json').predictions
const library = R('public/newskick-templates-from-bbpress.json').templates

/** page number (1-based) -> blocks in content points */
function pageBlocks(n) {
  const raw = n === 1 ? seed['0'] : preds[String(n - 1)]
  return (raw || []).map(toPt)
}
const bestFor = (n) => rankTemplates(pageBlocks(n), library, CONTENT)[0]

// From learning/template-provenance.md — which template each page produced.
const L = 'BBPRESS_SPLIT_EDITORIAL_LEFT'
const Rt = 'BBPRESS_SPLIT_EDITORIAL_RIGHT'
const T = 'BBPRESS_LEAD_TOP_ADS_BOTTOM'
const TRUTH = {
  2: 'BBPRESS_MASTHEAD_STORY', 3: T, 5: L, 6: 'BBPRESS_STACKED_FEATURES', 7: L, 8: Rt,
  9: 'BBPRESS_NEWS_ADGRID', 10: Rt, 11: L, 12: 'BBPRESS_CLASSIFIEDS_ADGRID', 14: T, 15: T, 16: T
}
// p1 cover / p4 briefs-over-split hybrid / p13 puzzles: no archetype was shipped for these.
const UNTEMPLATED = [1, 4, 13]

describe('fixtures', () => {
  it('are actually present — a silently empty fixture would make every test below vacuous', () => {
    expect(seed['0']).toHaveLength(8)
    expect(Object.keys(preds).length).toBe(15)
    expect(library.length).toBe(7)
    for (let n = 1; n <= 16; n++) expect(pageBlocks(n).length, `page ${n}`).toBeGreaterThan(0)
  })
})

describe('geometry primitives', () => {
  it('iou is 1 for identical rects, 0 for disjoint', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 }
    expect(iou(a, a)).toBe(1)
    expect(iou(a, { x: 20, y: 0, w: 10, h: 10 })).toBe(0)
  })
  it('iou halves correctly on a 50% overlap', () => {
    // overlap 50, union 150 -> 1/3
    expect(iou({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 })).toBeCloseTo(1 / 3, 5)
  })
  it('kind weight punishes a wrong kind and forgives editorial near-misses', () => {
    expect(kindWeight('ad', 'ad')).toBe(1)
    expect(kindWeight('editorial', 'wild-art')).toBe(0.6)
    expect(kindWeight('editorial', 'ad')).toBe(0.15)
  })
  it('normalize maps content points onto 0..1 of the content area', () => {
    const [n] = normalize([{ kind: 'ad', x: 373.5, y: 356.5, w: 373.5, h: 356.5 }], 747, 713)
    expect(n.x).toBeCloseTo(0.5, 3)
    expect(n.y).toBeCloseTo(0.5, 3)
  })
})

describe('scoring behaviour', () => {
  const slot = (kind, x, y, w, h) => ({ kind, x, y, w, h })
  const tmpl = (blocks) => [{ id: 't', name: 't', type: 'ad-editorial', pageWidth: 747, pageHeight: 713, blocks: blocks.map((b) => ({ ...b, width: b.w, height: b.h })) }]

  it('scores an exact match at 1', () => {
    const page = [slot('editorial', 0, 0, 373, 713)]
    expect(rankTemplates(page, tmpl(page), CONTENT)[0].score).toBeCloseTo(1, 5)
  })
  it('weights by area — missing a big block hurts more than missing a small one', () => {
    const base = slot('editorial', 0, 0, 373, 700)
    const big = slot('ad', 374, 0, 373, 700)
    const small = slot('ad', 374, 0, 40, 40)
    const missBig = rankTemplates([base], tmpl([base, big]), CONTENT)[0].score
    const missSmall = rankTemplates([base], tmpl([base, small]), CONTENT)[0].score
    expect(missSmall).toBeGreaterThan(missBig)
  })
  it('counts unmatched slots against the score', () => {
    const page = [slot('editorial', 0, 0, 373, 713)]
    const exact = rankTemplates(page, tmpl(page), CONTENT)[0].score
    const extra = rankTemplates(page, tmpl([...page, slot('ad', 374, 0, 373, 713)]), CONTENT)[0]
    expect(extra.score).toBeLessThan(exact)
    expect(extra.unmatchedSlots).toBe(1)
  })
})

describe('BBP 5/8/26 — the matcher picks each page’s own archetype back out', () => {
  for (const [page, expected] of Object.entries(TRUTH)) {
    it(`p${page} → ${expected.replace('BBPRESS_', '')}`, () => {
      const best = bestFor(Number(page))
      expect(best.name, `p${page} matched ${best.name} @ ${best.score.toFixed(2)}`).toBe(expected)
      expect(best.score).toBeGreaterThan(0.5)
    })
  }

  it('wins outright on every templated page, and most by a mile', () => {
    const margins = Object.keys(TRUTH).map((page) => {
      const [a, b] = rankTemplates(pageBlocks(Number(page)), library, CONTENT)
      expect(a.score - b.score, `p${page} margin`).toBeGreaterThan(0)
      return a.score - b.score
    })
    // Decisiveness is the norm; p16 below is the one honest exception.
    expect(margins.filter((m) => m > 0.25).length).toBeGreaterThanOrEqual(9)
  })

  it('p16 is the genuinely hard case — its GEOMETRY is stacked-features; only kind decides', () => {
    // p16 = full-width story over a full-width ad. Structurally that is exactly
    // STACKED_FEATURES (full-width block over full-width block); the only thing
    // separating them is the bottom block's kind. So the margin is thin on
    // purpose — this test pins that the kind weight is what carries it, and
    // will fail loudly if someone "simplifies" kind weighting away.
    const [a, b] = rankTemplates(pageBlocks(16), library, CONTENT)
    expect(a.name).toBe('BBPRESS_LEAD_TOP_ADS_BOTTOM')
    expect(b.name).toBe('BBPRESS_STACKED_FEATURES')
    expect(a.score - b.score).toBeLessThan(0.05)
  })
})

describe('abstention — it must not confidently match a page no archetype covers', () => {
  it('the cover scores low and ambiguous (no cover template shipped)', () => {
    const [a, b] = rankTemplates(pageBlocks(1), library, CONTENT)
    expect(a.score).toBeLessThan(0.3)
    expect(a.score - b.score).toBeLessThan(0.1) // nothing stands out = correct
  })
  it('the hybrid and puzzle pages land mid, never strong', () => {
    for (const n of [4, 13]) expect(bestFor(n).score, `p${n}`).toBeLessThan(0.75)
  })
  it('every untemplated page scores below every confident templated one', () => {
    const worstConfident = Math.min(...[3, 6, 8, 10, 12, 15].map((n) => bestFor(n).score))
    const bestUntemplated = Math.max(...UNTEMPLATED.map((n) => bestFor(n).score))
    expect(bestUntemplated).toBeLessThan(worstConfident)
  })
})

describe('page → template', () => {
  it('infers cover from a What’s Inside rail', () => {
    expect(inferType(pageBlocks(1))).toBe('cover') // p1 has the what-inside rail
  })
  it('infers ad for an all-ad/filler page, ad-editorial otherwise', () => {
    expect(inferType(pageBlocks(12))).toBe('ad') // classifieds filler + 8 ads, no editorial
    expect(inferType(pageBlocks(5))).toBe('ad-editorial')
  })
  it('emits a PageTemplate that round-trips back to its own archetype', () => {
    const t = pageToTemplate(pageBlocks(8), { paper: PAPER, name: 'BBP · ROUNDTRIP' })
    expect(t.pageWidth).toBe(747)
    expect(t.pageHeight).toBe(713)
    expect(t.origin).toBe('ai')
    for (const b of t.blocks) {
      expect(b.x + b.width).toBeLessThanOrEqual(747.5)
      expect(b.y + b.height).toBeLessThanOrEqual(713.5)
    }
    // the strongest check: feed it back in and it should match itself ~perfectly
    const self = rankTemplates(pageBlocks(8), [t], CONTENT)[0]
    expect(self.score).toBeGreaterThan(0.98)
  })
  it('carries editorial role + photo hints so the layout audit can score slots', () => {
    const t = pageToTemplate(pageBlocks(5), { paper: PAPER, name: 'x' })
    const lead = t.blocks.find((b) => b.role === 'lead')
    expect(lead).toBeDefined()
    expect(lead.requiresPhoto).toBe(true)
    expect(lead.imageRatio).toBe(0.4)
  })
})
