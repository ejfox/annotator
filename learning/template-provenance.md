# Template provenance — Beach & Bay Press, May 8 2026

Every template in `newskick-templates-from-bbpress.json` traces to specific pages of
**BBP 5/8/26** (`beach-and-bay-press-may-8-2026.pdf`, 16pp, 61 annotated blocks).

**Annotation confidence:**
| pages | how it was annotated |
|---|---|
| p1 | hand-drawn by EJ (the gold reference — **with one correction, 2026-07-15: see below**) |
| p2 | model first-pass, **hand-corrected by EJ** (merged 2 fillers → 1; enclosed full height) |
| p3 | model prediction, **accepted verbatim, zero edits** |
| p4 | model prediction, **hand-realigned by EJ** (row divider only; all classes accepted) |
| p5–p16 | model prediction (full-issue pass), spot-checked |

---

## A · `BBPRESS_SPLIT_EDITORIAL_LEFT` — pp. 5, 7, 11
Lead story fills the left half (cols 1–2), two stacked ads fill the right (cols 3–4).

| page | editorial (left) | ads (right, top → bottom) |
|---|---|---|
| **5** | "Annual homeless count shows progress in suburbs and for vets" (Thomas Murphy) + Kohler pull-quote | RealestAgent / Coldwell Banker realtor · PB Elementary "2025-26 Platinum Sponsors" logo wall |
| **7** | "Grocery Outlet bargains come to Pacific Beach" (Noah Perkins) | Compass "JUST SOLD — 4410 Gresham St" · Pueblo "Chilaquiles Anyone? / Baja Breakfast" |
| **11** | "Pacific Beach Chalcifica ADU project still alive despite default notice" (Dorian Hargrove) | Coleman Moving Systems · San Diego Masonry |

**Variance:** pp. 7 & 11 each carry a small bordered brief inside the editorial half
(p7 "SEAWORLD DRONE SHOWS", p11 "MT. SOLEDAD") that the model folded into the article
block rather than splitting out. The ad divider sits at y≈0.5 on all three.

## A-mirror · `BBPRESS_SPLIT_EDITORIAL_RIGHT` — pp. 8, 10
One full-height ad owns the left half; the story owns the right.

| page | ad (left, full height) | editorial (right) |
|---|---|---|
| **8** | UPLIFT / House of Blues "Mother's Day Gospel Brunch" | "Local artists speak out against arts cuts in budget" (Dave Schwab) + Daly pull-quote |
| **10** | Express Flooring "Up to 75% Off" | "D2 candidates discuss city's budget cuts, and Midway Rising at forum" (Tessa Balc) |

**Variance:** none — both pages are a clean 50/50 vertical fold, full height each side.

## B · `BBPRESS_LEAD_TOP_ADS_BOTTOM` — pp. 3, 14, 15, 16
Full-width lead on the top half; ads across the bottom. **The ad row is the variable.**

| page | editorial (top, full width) | ads (bottom) |
|---|---|---|
| **3** | "City says remote work events on beaches need permits" (Thomas Murphy) + beach photo | **2:** Marc D. Mabile attorney · Broken Yolk "Ciabatta Believe It" |
| **14** | "Hope and hard work keep paralyzed PB surfer on track for MBA" (Karen Pearlman) | **3:** addressSD "Start Your Move" · Rick's Home Repair/Handyman · Right Choice Senior Living |
| **15** | "Fashion Week San Diego kicks off season with Spring Showcase" (Diana Cavagnaro) | **2:** "One. Home. Left." 466 Westbourne · Cairncross "PB Triplex" |
| **16** | "Mission Bay: Where a wetland became a resort landscape" (Debbie L. Sklar) | **1:** full-width "Color Scott… Contest" / Scott Booth Compass |

**Variance:** canonical template ships the 2-ad form (pp. 3, 15 — the modal case).
p14 splits the right ad slot in two; p16 merges both into one full-width unit.
The story/ad fold sits at y≈0.5 on all four.

## C · `BBPRESS_NEWS_ADGRID` — p. 9
News band on top, matrix of small local ads below.

- **Editorial:** "Local arts organizations rally against proposed cuts" (Dave Schwab) + PB Arts Center rendering
- **Ads (6):** "Local Ads" house · Beach Laundromat · Lanna Thai · West Coast Animal Hospital
  (**double-height**, spans both rows in col 4) · Coastal Sage Gardening (**double-width**,
  spans cols 1–2 in row 2) · Amy Cleaners & Alterations

**Variance:** the real grid is irregular — one double-height and one double-width cell.
The template **regularizes to a clean 4×2 of eight equal cells**; merge cells as needed.

## C2 · `BBPRESS_CLASSIFIEDS_ADGRID` — p. 12
The purest example of the matrix — typed `ad` since the header is filler, not editorial.

- **Filler:** "COMMUNITY CLASSIFIEDS" (help wanted + fictitious business name statements + legals)
- **Ads (8, a true 4×2):** Home Service Guide · Crown Point Clippers · Handyman Solutions ·
  Honor Guard Roofing — then Chuckie's Painting · Rent-A-Husband · Roy & Roger's Window
  Cleaning · Bill Harper Plumbing

**Variance:** none — this page *is* the canonical grid, and the template matches it 1:1.

## D · `BBPRESS_STACKED_FEATURES` — p. 6
Two full-width stories stacked, no advertising on the page at all.

- **Top (lead):** "Mission Bay High Para athlete commits to SDSU for track" (Cyril A. Reinicke)
- **Bottom (secondary):** "Mission Bay students raise awareness of Rose Creek as vital resource"

**Variance:** none. Only ad-free page in the issue.

## E · `BBPRESS_MASTHEAD_STORY` — p. 2 (+ p. 13 variant)
Standing matter rail (filler) left, story right.

- **p2** — *hand-corrected by EJ, so this is the highest-confidence template in the set.*
  Filler rail = masthead, address, WHO WE ARE staff list, submissions/letters, newsletter QR
  + ASU NewsWell donate. Editorial = "New playground at Fanuel Park among several Mission
  Bay improvements" (Dave Schwab) + Becker pull-quote + groundbreaking photo.
  **EJ's fix here defined two of the four house rules:** *one block per region* (he merged
  the model's split staff-box/promo fillers into one rail) and *enclose content fully*
  (he pulled both blocks to y≈1599px, past the nominal bottom margin).
- **p13** — all-filler variant, **not shipped as a template**: legals continued (left) +
  Sudoku / Crosswords / answers (right) + an Instagram house promo. Too bespoke; puzzles
  are better served by the runtime filler placement system.

---

## Pages deliberately not templated

- **p1 — Cover.** Bespoke: nameplate + What's-Inside rail + 6-photo package + cover story +
  sports/parks refers + 2 bottom ads. Studio already carries cover templates
  (`BBPRESS_EJSANITY_DEMO_COVER`); EJ's hand-drawn p1 is available to promote into one if wanted.
- **p4 — Hybrid.** Template B's brief band (VOTE AT PB LIBRARY / EMPTY THE SHELTERS) sitting
  on top of Template A's split (Summer Camps editorial left, two camp ads right). Worth adding
  as `BBPRESS_BRIEFS_OVER_SPLIT` if the combo recurs in another issue — holding for a second
  data point.

## The grid underneath

Every block edge in the issue landed on the same lines (fraction of the 747×713 content area):

- **vertical:** 0 · 0.25 · **0.50** · 0.75 · 1.0
- **horizontal:** 0 · **0.50** · 0.75 · 1.0

~~The **50% fold on both axes is the master line**~~ — **WITHDRAWN, see RESEARCH.md §4.** The figures below were computed from annotations drawn with snap-to-grid on, so they measured the tool, not the paper. Kept struck through rather than deleted because the templates below were authored while believing it. (37 vertical / 21 horizontal block edges
land on it). Templates are authored to it: half = 367.5pt, right half starts 379.5pt,
quarter columns = 177.75pt on the standard 4-col grid.


## Correction — the gold reference had a mislabelled block (2026-07-15)

p1's bottom-right block (`x=866 y=1356 w=762 h=243`) was tagged `article · secondary`.
It is a **PB Foreign Car Repair advertisement** — coupons, dashed cut-out borders, expiry
dates. Relabelled to `ad` in the seed file, in `store.js`'s bundled SAMPLE, and on disk.

**How it surfaced.** EJ asked why Studio's `BBPRESS_EJSANITY_DEMO_COVER` was "such a bad
match" for the cover at 0.53. It wasn't a bad match. The geometry paired at IoU 0.67–0.80
on every block; the whole deficit came from two kind disagreements, and on the first one
the *template was right and we were wrong*. Relabelling lifts the match 0.527 → 0.589.

**Still open — a real taxonomy question, EJ's call.** The template also calls the centre
photo package (`x=365 y=279`) `wild-art`, where the seed calls it `article · lead`. It is a
photo collage with a caption and no body copy — the story text lives in the COVER STORY
column beside it. Accepting that too takes the match to **0.682**. The same question applies
to the Peninsula Beacon cover, annotated the same way.

**Why this matters beyond one label.** p1 is the seed the entire flywheel grew from: all
four house rules were distilled from it, and this file calls it the gold reference. It does
not affect the 13/13 matcher guard (p1 is untemplated there) or the cover's abstention
(it still scores 0.19 against the bundled library, which ships no cover template). But the
reference was not clean, and a confidence score disagreeing with a human is not
automatically the score being wrong.
