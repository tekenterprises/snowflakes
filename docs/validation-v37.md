# v37 processing optimization validation

## Scope and provenance

Baseline: `aee63f12ebbc38d466d37ace9a88a775badd00bb` (v36 release record).
The optimized code retains the accepted image center, trunks, hexagons, branch
slots, geometric predicates and photographic resolution. There are no runtime
reference identities or per-specimen overrides. Unrelated preexisting edits are
excluded from the commit; the release candidate is exported as raw Git bytes.
This record describes code publication, not a Cloudflare deployment.

The changes add bounded decoded-image, raster, center and completed-result caches;
source cancellation and export freshness guards; exact hex/registration/spatial
kernel optimizations; and UI-owned helper workers for local branches and initial
material preparation. Timed crystal partition/repair remains serial. The shared
partitioner also gains certified fallback constructions for previously failing
supported regions. These preserve their target material and direct supports.

## Processing measurements

The desired cold-load target is 2–3 seconds. It is **not consistently met**.
Cached returns and cold computation are measured separately.

Fresh isolated Node processes, three alternating baseline/candidate runs per
reference, 768px original RGBA, faithful symmetry, Detail 100 and Fill on:

| Reference | v36 median | v37 median | Reduction |
| --- | ---: | ---: | ---: |
| 3 | 9.02 s | 4.49 s | 50% |
| 6 | 15.90 s | 8.72 s | 45% |
| 18 | 11.49 s | 5.76 s | 50% |
| 20 | 10.98 s | 5.53 s | 50% |

These are serial Node measurements, not browser latency. They were taken before
the final failure-only partition retry; all compared successful reference layouts
remain identical. Every measured pair preserves the center, branches, hexagons,
cell coordinates, supports and actual cut exactly. Added and omitted thresholded
photo material and signed area bias were recorded separately; they are unchanged
between these identical outputs. Raw-threshold counts include intentionally
filled internal photographic texture.

Actual local browser checks use the application's PNG decoder/canvas, its 768px
artboard, source scale 90%, Detail 100, faithful symmetry and Fill on. Selection to
SVG-export-enabled time, including automation overhead, was 3.63s for reference 3
and 7.59s for 18. Returning to cached 3 took 0.36s, including while canceling another
source. These single observations are not a cross-device performance guarantee.
The browser's reference 6 also exercises a slow tail that exceeds 15s; remaining
partition search retries prevent a general cold-load latency guarantee. Replaying
that exact browser input's cached analysis took 27.58s for crystals alone: six
sides still needed a fine-to-coarse retry. All twelve sides and assembly validated
(1,087 cells, four actual cut holes). This tail remains a known performance issue.

## Correctness and failure coverage

- The static build and default package suite pass in the complete checkout and
  an isolated task-only Git candidate.
- All twenty original references pass fresh integration at symmetry 0/50/100,
  Fill/detail cache-order changes, source-guide visibility independence and final
  manufacturing symmetry. Checks compare the actual cell union with the actual
  base cut including holes, overlap, positive finite 3–6 facets, direct finite
  supports, shared edge incidence, connectivity and exact full symmetry.
- Hex/framework and branch golden checks retain all twenty accepted analyses.
  Exact-kernel regression oracles cover candidate order, tolerances, edge ties,
  directed hex offsets, degenerate inputs and bounded cache lifetimes.
- The final failure-only partition additions preserve all twenty saved single-side material
  layouts, cell counts, actual cuts and holes exactly. A separately captured real
  browser-canvas region proves both coarse and fine supported partitions without
  coarsening, added/omitted material beyond the existing numerical tolerance,
  interior overlap, floating cells or changed holes.
- Worker lifecycle tests cover pool startup/error/timeout, partial completion,
  old-generation messages, cancellation and serial fallback. Actual helper tests
  compare branch fits and cloned initial material targets with serial inputs. All
  240 helper-prepared sides and their complete assembled cuts match serial output.
- Export/source tests cover pending image decode, selection and settings races,
  failed image decode recovery, cached returns and current-result waiting.

Diagnostic evidence is outside deployable assets in
`review-prep/optimization-implementation/`: the raw baseline, performance records,
output comparisons, all-20 integration log, browser input captures, partition
proofs and screenshots. Automated fixture rasterization and actual browser checks
are distinct; browser canvas resampling can expose different partition cases.
