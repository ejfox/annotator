> **CORRECTION issued 2026-07-15 — this memo was sent, and finding #2 in it is wrong.**
> It claims "every block edge lands on a quarter grid, with the 50% fold dominant on both axes."
> That is withdrawn: the horizontal half measured our editor's snap-to-grid setting rather than the
> newspaper, and the vertical half restated the definition of the 4-column paper preset (its gutter
> centres are 0.246/0.500/0.754 — the "quarters" it was tested against). Finding #1 (six archetypes)
> stands and has since been tested on two more issues. Details: RESEARCH.md §4. The memo text is left
> unedited below, as sent.

# Memo: page templates from a real issue, a matcher, and two API asks

**To:** the NewsWell Studio team
**From:** the annotator side (EJ + Claude) — [github.com/ejfox/annotator](https://github.com/ejfox/annotator)
**Re:** [ejfox/newswell#142](https://github.com/ejfox/newswell/pull/142), template matching, and `/api/templates`
**Date:** 2026-07-15

---

## TL;DR

1. We annotated a full issue by hand+model (Beach & Bay Press 5/8/26 — 16 pages, 60 blocks) and distilled **six page archetypes** that cover every page. They're in PR #142 as seven `PageTemplate`s with `origin: 'ai'`, plus 8 tests against your real capacity/grid math.
2. Every block edge in that issue lands on a **quarter grid**, with the **50% fold dominant on both axes**. That's the paper's whole layout grammar.
3. We built a **template matcher** (geometry, not words). It picks the right template on 13/13 pages of ground truth.
4. **Two asks:** method-aware public `GET /api/templates`, and a new `POST /api/templates` that appends one template.
5. **One security finding you should fix regardless of anything we want.** See below.

---

## ⚠️ Read this part first

`server/api/templates/index.put.ts` has no auth check of its own — its docstring says *"Auth-gated by the global server middleware."* And `PUBLIC_ROUTES` matches by **`startsWith`**.

So the day anyone adds `/api/templates` to that allowlist to make the library readable, they also make **PUT public** — and PUT **replaces the entire library, last-write-wins**. Unauthenticated internet users could blank every template you have. `publicRoutes.ts` already documents that you shipped this exact bug once under `/api/changelog/*`.

We nearly walked into it doing precisely that. It isn't hypothetical.

Suggested fix, independent of our asks: give the PUT its own `isAuthenticated(event)` guard so the allowlist isn't a single point of failure, and extend `tests/auth-public-routes.spec.ts` to assert that writes stay 401 even if the prefix appears.

---

## What we found

Annotating all 16 pages and then looking at the geometry: **every** block edge lands on the same few lines, expressed as fractions of the 747×713 content area.

- **Vertical:** `0` · `0.25` · **`0.50`** · `0.75` · `1.0`
- **Horizontal:** `0` · **`0.50`** · `0.75` · `1.0`

The 50% fold carries 37 vertical and 21 horizontal block edges. Six shapes then cover all 16 pages:

| archetype | pages |
|---|---|
| Split — editorial ▏ ads (either orientation) | 5, 7, 8, 10, 11 |
| Lead on top / ad row beneath | 3, 14, 15, 16 |
| Header band + 4×2 ad matrix | 9, 12 |
| Two stacked full-width features | 6 |
| Masthead rail + story | 2 |
| Cover (bespoke) | 1 |

Practical upshot: an inside page is a fold plus a fill. If that holds on a second issue, template *selection* is a much smaller problem than it looks.

## The matcher

`src/lib/templateMatch.js` — pure, no framework, ~90 lines. Given a page's blocks and a template library, it ranks templates:

1. Normalize both sides to fractions of their own content area (paper-independent).
2. Score every (block, slot) pair as **IoU × kind weight** (same kind 1.0; editorial↔wild-art↔what-inside 0.6; otherwise 0.15).
3. Greedily pair highest-first — blocks per page are single digits, so a Hungarian solve is indistinguishable and much harder to read.
4. **Score = fraction of combined AREA matched well.** Unmatched blocks on either side pay their full area into the denominator.

Area-weighting is the load-bearing choice: getting the half-page lead right should count for far more than missing a business-card ad, and a count-based score says the opposite.

**Results** — all 16 pages against the 7 templates distilled from them:

- **13/13 top-1** on templated pages, margins Δ0.4–0.5 over the runner-up.
- Correctly abstains where it should: cover **0.19** (Δ0.01 — "none of these"), hybrid p4 **0.57**, puzzles p13 **0.51**.
- Honest when right: p16 scores only **0.59** for its own archetype, because its bottom is one full-width ad where the template has two. The score is a real confidence signal, not a leaderboard.

**Why you might care:** your `computeTemplateCapacity` scores *"can this content fit this slot"* (words). This scores *"does this template describe this layout"* (geometry). They're the two halves of the same question and they compose — geometry to shortlist, capacity to confirm.

There's also an inversion worth noting. We match layout→template. Studio's actual problem is content→template. Same math, different input: rasterize the desired blocks, rank, then let capacity break ties.

## Ask 1 — public `GET /api/templates`

EJ's call: the template library is layout skeletons, not secrets, so public read is fine. But it must be **method-aware** — public GET, authed PUT — because of the prefix issue above. Roughly:

```ts
export const PUBLIC_GET_ROUTES: readonly string[] = ['/api/templates']
// middleware: if (event.method === 'GET' && PUBLIC_GET_ROUTES.some(p => path.startsWith(p))) return
```

Plus the guardrail test asserting `PUT /api/templates` is still not matched.

CORS is already `*`, so browsers can reach it the moment this lands. Until then the annotator falls back to a bundled snapshot and labels itself `BUNDLED` in the UI rather than pretending.

## Ask 2 — `POST /api/templates` (append one)

We want a "send this page to Studio as a template" button. We are **not** willing to implement it against PUT: GET → append → PUT-the-whole-array will silently eat a concurrent edit, and your own docstring flags last-write-wins as a known-acceptable-for-now compromise. That's fine for a human editing in the admin; it's not fine for a second client writing over the top.

An authed `POST /api/templates` that appends a single `PageTemplate` and returns the saved row is small, race-free, and useful beyond us. Until it exists, our button builds a valid one-template library file for manual import.

## What we're not claiming

- **n=1.** One paper, one issue, one day. The six shapes are a strong signal, not a law. We held back a seventh archetype (a briefs-band-over-split hybrid, p4) precisely because it only appeared once.
- **Pages 5–16 are model output that got spot-checked, not reviewed.** Pages 1–4 are hand-drawn or hand-corrected. The archetypes are visually unmistakable, and templates are authored to the canonical grid so per-page pixel error doesn't propagate — but the block-level annotation on two-thirds of the issue hasn't had a human pass.
- **Nobody has rendered one of these templates in Studio.** We validated them against your capacity and grid math (8 passing tests), not against pixels. Schema-valid and useful-in-practice are different claims; we've only earned the first two.
- **No CI runs those tests.** `deploy-studio.yml` and `release.yml` don't invoke vitest, so the guard we added only helps if someone runs `npm test`.

## How it was made, briefly

Hand-annotate **one** page → model predicts the next → human tunes → diff the fix against the guess → distill a rule → repeat. Page 3 came back needing zero edits; pages 5–16 went in one pass. Four rules did the work: one block per region, enclose content fully, boundaries on the true content edge, split distinct ads. The provenance for every template — exact source pages, actual stories and advertisers, and where each page departed from the archetype — is in [`learning/template-provenance.md`](template-provenance.md).
