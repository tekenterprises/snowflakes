# Browser reconstruction engine (v37)

The default geometry path ports the approved shared prototype into browser-local
JavaScript. There are no reference-number lookups, saved geometry downloads,
Python subprocesses, or specimen-specific runtime corrections. Reference images
remain ordinary regression inputs. The maintained static source is `dist/`.

## Stages and coordinates

1. `reconstruction-framework.js` finds a center by sixfold grayscale symmetry
   inside a circular radius of 25% of the image width. It searches near the image
   midpoint; explicit manual centers override the search. Straight trunks fit
   image evidence independently. Nested convex hexagons have their vertices on
   those trunks. Faint hubs use the accepted bounded 7%-of-reach inferred prior.
2. `reconstruction-branches.js` extracts all twelve half-arms to their actual
   neighboring bisectors. Center-start, best-fit uniform scale registration
   precedes a valid-pixel masked median. The median central hex footprint is
   excluded from branch detection. Shared branch slots fit local straight axes,
   roots, and connected image tips separately on each side.
3. `reconstruction-partition.js` and `reconstruction-cells.js` port the accepted
   median guidance and finite-support partitioner. They retain connected image
   material, classify photographed cavities, fit artistic faceted boundaries,
   partition around holes, and conform shared edge junctions. Every retained cell
   has 3–6 actual facets and a vertex or face on a finite branch, trunk, or hex
   support. Collinear seam vertices do not add facets; cells may be concave.
4. `reconstruction.js` caches analysis, median guides, and final meshes. Faithful
   geometry keeps the accepted local fits. Intermediate symmetry blends aligned
   image evidence and skeletons before repartitioning. Local subdivisions may
   change around different cavities; branch identities remain shared. At 100%,
   a regular 30-degree canonical half-arm is mirrored and rotated twelve times.
   The central cell and the displayed hexes use the same posed geometry.
5. `cut-output.js` consumes the actual cell union directly. It does not run the
   legacy silhouette/cavity fitter over these cells. Offset, rounding and gap
   closing are later manufacturing operations; the hanger is added last. Source
   trace cuts retain their own hole policy independently of guide visibility.

The editor displays a 768px artboard. The initial circular center search uses the
full 768px normalized crop, not a 192px thumbnail. After alignment, the worker
receives an explicit artboard center, so manual and automatic alignment are not
silently estimated twice. Canonical coordinates are lateral x / radial y, with
median trunk length 320. Source mapping is
`center + pixel/scale * (y*u + x*v)`. Raster evidence uses Float32; geometry uses
JavaScript Float64 numbers. Frame angles are radians; branch angles are degrees.
The numerical weld tolerance is 3e-5 canonical px (4e-5 source px). This is distinct
from the artistic contour tolerance, 1.6–4 canonical px according to Detail.

Regular symmetry samples image evidence across the half-arm boundary before exact
clipping. A reflected seam is an interior domain boundary for hole classification;
its crop must not manufacture a thin slit on photographed material.

## Ownership, holes, and failure behavior

Photographs are evidence, not literal contour instructions. The accepted coarse
interpretation avoids contour chatter while preserving supported protrusions and
holes. Disconnected marks without finite skeleton support are excluded before
morphological closing; they never gain a floating crystal. Tiny antialias samples
next to supported material can remain. Fill keeps supported structural cavities;
turning it off retains additional clear cavities. It never invents an absent
local cavity. Symmetry may repeat canonical evidence.

The outermost detected hex is the central material cell; nested hexes remain
semantic/preview guides. The cell union, including its actual holes, owns the base
crystal cut. Preview outlines are not clipped to an independent silhouette.
Partitions validate positive area, finite coordinates, direct finite supports,
facet counts, overlap, and shared edge incidence before publication to the UI.
Failures are reported; stale geometry cannot be exported. A cold image requires
all image stages; manufacturing controls reuse reconstruction. Worker jobs coalesce
to the latest settings. Geometry and raster caches are bounded.

## Processing and reuse

The UI retains up to six decoded images (48 MiB estimated), three normalized
rasters (24 MiB estimated), twelve center estimates, and six completed result
DTOs (16 MiB estimated). Stable decoded-image and crop identities allow a return
to a recent flake to reuse its completed geometry. Result keys include the
artboard size, center override, settings, and required preview capabilities.
These are conservative accounting limits, not measurements of browser heap size.

Image selection invalidates outstanding export work before decoding begins. A
new source cancels the primary worker and its helpers when processing is active.
Generation and request checks reject late results. A failed upload restores the
previous valid image; export always waits for the current source and settings.

The UI owns a bounded pool of two to four sibling workers on machines that
advertise enough logical processors. They fit the twelve local branch sides and
prepare each side's initial material target. Source arrays are cloned, not
transferred away from the coordinator. Deadline-sensitive crystal partition,
repair, and finalization run serially in side order after helper preparation
finishes. Helper failure retains completed work, stops the pool, and retries
unfinished work serially. Browsers without worker support use the synchronous
compatibility path.

The image kernels reuse directed-edge hex evidence, registration sample terms,
and conservative spatial indexes. Broad phases only reject candidates proven
outside the original geometric tolerances; exact predicates and candidate order
still decide acceptance. If a mapped supported-cell partition fails, a bounded
straight-fan fallback and a visibility-ranked finite-anchor retry can recover a
complete 3–6-facet subdivision. Existing successful searches keep their cells.
The actual union, holes, direct supports, overlap, and incidence checks remain
authoritative.
No lower image resolution or per-reference optimization is used.

## Verification

`npm run build` validates static assets and script syntax. `npm test` includes the
portable reconstruction, actual worker, export freshness, visibility, hole and
legacy regressions. Optional full photographic checks use the preserved external
prototype fixtures, never runtime geometry:

```
node tests/reconstruction-framework.cjs --references
node tests/reconstruction-branches.cjs --golden
node tests/reconstruction-cells.cjs --references
node tests/local-fit-pool.cjs --cell-refs=all
node tests/reconstruction-integration.cjs --references 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
```

`SNOWFLAKE_FIXTURES` selects the original RGBA fixture directory. Framework tests
also accept `SNOWFLAKE_PROTOTYPE` for the central-hex oracle folder. Diagnostic
artifacts stay outside `dist/`. Automated rasterization, actual browser checks,
and visual acceptance are separate evidence. See the version validation record
for measurements and release provenance.
