"""
Recursive XY-cut segmentation.

Whole-page ink profiles can only find boundaries that run the full width/height
of the page, so on an 8-region cover they find almost nothing and blocks end up
eyeballed. XY-cut instead finds the widest whitespace gap WITHIN a region, splits
there, and recurses — so it resolves the INSIDE rail, the wild art, and the cover
story separately.

The leaves give geometry. Our existing annotation gives semantics: each block
claims the leaves whose centres fall inside it, and snaps to their union — which
is exactly "enclose the content fully" (house rule 2), measured rather than typed.
"""
from PIL import Image
import numpy as np, json, os

SCALE_W = 1040
MAXMOVE = 60   # natural px an edge may be corrected by

def ink_mask(path):
    img = Image.open(path).convert('RGB'); natW, natH = img.size
    s = min(SCALE_W, natW)/natW
    cw, ch = round(natW*s), round(natH*s)
    a = np.asarray(img.resize((cw, ch), Image.BILINEAR), dtype=np.float32)
    gray = a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    sat = a.max(2) - a.min(2)
    return ((gray < 200) | (sat > 45)), s

def widest_gap(density, min_gap, thr=0.012):
    """widest interior run below thr; returns (centre, width) or None"""
    quiet = density < thr
    best = None; st = None
    for i, q in enumerate(quiet):
        if q and st is None: st = i
        if not q and st is not None:
            if st > 0 and (i - st) >= min_gap and (best is None or i - st > best[1]):
                best = ((st + i)//2, i - st)
            st = None
    return best

def tighten(mask, x0, y0, x1, y1):
    sub = mask[y0:y1, x0:x1]
    if not sub.any(): return None
    r = np.nonzero(sub.any(1))[0]; c = np.nonzero(sub.any(0))[0]
    return (x0+int(c[0]), y0+int(r[0]), x0+int(c[-1])+1, y0+int(r[-1])+1)

def leaves(mask, box, min_gap, min_size, depth=0):
    t = tighten(mask, *box)
    if t is None: return []
    x0, y0, x1, y1 = t
    if depth >= 9 or (x1-x0) <= min_size or (y1-y0) <= min_size:
        return [t]
    sub = mask[y0:y1, x0:x1]
    # A gap must span the region's FULL extent to be a cut. Text lines don't align
    # across columns, so leading never spans a multi-column region and can't be
    # mistaken for a boundary — which means the threshold can be small. It must be:
    # the gap above the cover's full-width ad is 16 scaled px, and an earlier
    # min_gap*1.6 = 17 rejected it by one pixel, which stranded the whole body as a
    # single leaf (no vertical cut is reachable until that ad is separated off).
    gx = widest_gap(sub.mean(0), min_gap)
    gy = widest_gap(sub.mean(1), min_gap)
    pick = None
    if gx and gy: pick = ('x', gx) if gx[1] >= gy[1] else ('y', gy)
    elif gx: pick = ('x', gx)
    elif gy: pick = ('y', gy)
    if not pick: return [t]
    ax, (c, _) = pick
    if ax == 'x':
        a = leaves(mask, (x0, y0, x0+c, y1), min_gap, min_size, depth+1)
        b = leaves(mask, (x0+c, y0, x1, y1), min_gap, min_size, depth+1)
    else:
        a = leaves(mask, (x0, y0, x1, y0+c), min_gap, min_size, depth+1)
        b = leaves(mask, (x0, y0+c, x1, y1), min_gap, min_size, depth+1)
    return a + b

def snap_page(path, blocks, min_gap=6, min_size=26):
    mask, s = ink_mask(path)
    H, W = mask.shape
    L = leaves(mask, (0, 0, W, H), min_gap, min_size)
    # drop the running head / folio strip
    L = [l for l in L if l[1] > 95*s]
    # Assign every leaf to the ONE block it overlaps most, rather than to any block
    # containing its centre. A wide leaf (e.g. a photo caption) can have its centre
    # inside a narrow neighbour and drag that block across the page when unioned.
    B = [((b['x']*s, b['y']*s, (b['x']+b['w'])*s, (b['y']+b['h'])*s), i)
         for i, b in enumerate(blocks)]
    owned = {i: [] for i in range(len(blocks))}
    for leaf in L:
        lx0, ly0, lx1, ly1 = leaf
        area = max(1, (lx1-lx0)*(ly1-ly0))
        best, ba = None, 0
        for (bx0, by0, bx1, by1), i in B:
            ov = max(0, min(lx1, bx1)-max(lx0, bx0)) * max(0, min(ly1, by1)-max(ly0, by0))
            if ov > ba: best, ba = i, ov
        # a leaf only belongs to a block if it's MOSTLY inside it; a leaf straddling
        # two blocks belongs to neither and must not drag either one across the page
        if best is not None and ba/area >= 0.6: owned[best].append(leaf)

    out = []
    for i, b in enumerate(blocks):
        claimed = owned[i]
        nb = dict(b)
        if claimed:
            X0 = min(c[0] for c in claimed)/s; Y0 = min(c[1] for c in claimed)/s
            X1 = max(c[2] for c in claimed)/s; Y1 = max(c[3] for c in claimed)/s
            # Snapping REFINES a block; it never relocates one. If the ink says an
            # edge belongs >MAXMOVE away, the annotation and the ink disagree about
            # what this block IS — trust the annotation and leave the edge alone,
            # rather than silently sliding a block onto its neighbour's content.
            ox0, oy0 = b['x'], b['y']; ox1, oy1 = b['x']+b['w'], b['y']+b['h']
            cl = lambda v, o: min(max(v, o-MAXMOVE), o+MAXMOVE)
            X0, Y0, X1, Y1 = cl(X0,ox0), cl(Y0,oy0), cl(X1,ox1), cl(Y1,oy1)
            if X1-X0 > 40 and Y1-Y0 > 40:
                nb.update(x=int(round(X0)), y=int(round(Y0)),
                          w=int(round(X1-X0)), h=int(round(Y1-Y0)))
        nb['_claimed'] = len(claimed)
        out.append(nb)
    return out, len(L)
