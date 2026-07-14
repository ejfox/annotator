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

## Page 3 — model v2 prediction (applying the above)

3 blocks: full-width **article/lead** (permits story + inline beach photo, top ~half,
x75→1632, enclosed y100→858) + **two ads** bottom (Marc Mabile attorney left,
Broken Yolk "Ciabatta" right), each sized to enclose to the page bottom (~y1598).
Awaiting EJ's tune to confirm the ad split + article/ad boundary.
