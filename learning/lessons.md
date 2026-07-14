# Annotation lessons (human-in-the-loop flywheel)

Rules distilled from EJ's edits vs. the vision model's first-pass guesses.
Applied to every future `predictions.json` pass.

## Page 2 — CONFIRMED delta (model v1 → EJ's fix)

Model guessed **3** blocks; EJ kept **2**:

| | model v1 | EJ's fix | lesson |
|---|---|---|---|
| masthead rail | split: staff `filler` + promo `filler` | **one** `filler`, x75 y100 → y1599 | **Don't over-split. One block per region.** The whole standing-matter column is a single block. |
| article | x470 y100 w1162 **h1475** | x470 y100 w1162 **h1499** (→ y1599) | **Enclose fully.** Extend to the real content bottom (~y1599), past the nominal bottom margin (y1575). |
| kind | `filler` | `filler` (unchanged) | `filler` is correct for masthead/standing matter — no new kind needed. |
| horizontal | x/width correct | unchanged | left/right extents were right; only vertical needed work. |

**Distilled rules:**
1. **One block per region — don't split.** Match EJ's region-scale instinct ("this HALF / this QUARTER").
2. **Enclose content fully + small pad.** Size to the outer pixel edge; content must never lap past a block edge. Extend past nominal margins to the true content bottom.
3. Story photos stay **inside** the article block (not separate wild-art) — held from page 1, unchallenged on page 2.
4. Dominant/sole story on a page → role **lead**.

## Page 3 — model v2: ACCEPTED VERBATIM ✅

3 blocks (full-width **article/lead** + **two ads** bottom). EJ kept it with **zero
edits** — his saved page 3 == the prediction, byte for byte. The page-2 rules
(one-block-per-region + enclose-fully) generalized perfectly. First clean hit.

## Page 4 — model v3 prediction (4 regions)

Busier page. Predicted: full-width **article/brief** band up top (community briefs:
VOTE AT PB LIBRARY / EMPTY THE SHELTERS) + left-half **article/secondary** (the
"Summer Camps & Activities" editorial section, cols 1–2, to page bottom) + **two
stacked ads** on the right (PB Arts Center camps ad, then the big Jr. Theatre
"Summer Camps" ad).
Open judgment calls to watch EJ's edits on:
- The "BE A PART OF THE NEXT SUMMER CAMPS SECTION / contact us" promo box is folded
  into the left editorial block — is it its own `ad`/`filler`?
- Is the "Summer Camps & Activities" section editorial (`article`) or advertorial?
- Top briefs as one `brief` block vs split.
