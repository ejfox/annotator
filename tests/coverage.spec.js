/**
 * Manifest/prediction coverage guard.
 *
 * Twice now an issue has sat in the switcher with zero blocks while its
 * predictions existed but had never been seeded — once because the seeding only
 * ever filled the ACTIVE project, once because predictions.json was keyed by
 * page but not by issue. Both failures were silent: the app cheerfully reported
 * three issues and showed you blank pages.
 *
 * These tests fail loudly instead. They check the committed data, not the app.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const R = (p) => JSON.parse(readFileSync(resolve(import.meta.dirname, '..', p), 'utf8'))
const issues = R('public/issues.json').issues
const preds = R('public/predictions.json').predictions
const types = new Set(R('public/types.json').types.map((t) => t.id))
const seed = R('public/samples/beach-and-bay-press-2026-05-08/annotations.seed.json')

describe('every issue in the manifest can actually be filled', () => {
  it('has at least one issue', () => expect(issues.length).toBeGreaterThan(0))

  for (const iss of issues) {
    describe(iss.id, () => {
      it('has predictions', () => {
        expect(preds[iss.id], `${iss.id} is offered in the switcher with no predictions`).toBeDefined()
      })

      it('covers every page (page 1 may come from a hand-drawn seed instead)', () => {
        const forIssue = preds[iss.id] || {}
        const missing = []
        for (let i = 0; i < iss.pages; i++) {
          const has = (forIssue[i] || forIssue[String(i)] || []).length > 0
          const seeded = i === 0 && (seed['0'] || []).length > 0 && iss.id.startsWith('beach-and-bay-2026-05-08')
          if (!has && !seeded) missing.push(i + 1)
        }
        expect(missing, `${iss.id}: pages with no blocks`).toEqual([])
      })

      it('uses only known block types and sane geometry', () => {
        for (const [pg, blocks] of Object.entries(preds[iss.id] || {})) {
          for (const b of blocks) {
            expect(types.has(b.cls), `${iss.id} p${+pg + 1}: unknown cls "${b.cls}"`).toBe(true)
            expect(b.w, `${iss.id} p${+pg + 1}: non-positive width`).toBeGreaterThan(0)
            expect(b.h, `${iss.id} p${+pg + 1}: non-positive height`).toBeGreaterThan(0)
            expect(b.x + b.w).toBeLessThanOrEqual(iss.imageW)
            expect(b.y + b.h).toBeLessThanOrEqual(iss.imageH)
          }
        }
      })
    })
  }
})
