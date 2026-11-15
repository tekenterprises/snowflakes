# v35 validation — 2026-11-15

Baseline: repository commit `fc29dfe`, previously deployed v34. Node 24.22.1 on
the Windows development workspace. Source fixtures and photographs are unchanged.

## Geometry repair

Reference 13, archived aligned 768px RGBA, threshold 230, detail 100, symmetry 0,
Fill on, largest piece, no offset/rounding/gap/hanger:

| Measure | v34 | v35 |
| --- | ---: | ---: |
| Actual material cells | 1,399 | 617 |
| Added source pixels | 43,549 | 8,034 |
| Omitted source pixels | 6,415 | 1,113 |
| Signed material bias, pixels | +37,134 | +6,921 |

Source area is 179,272 pixels. Added and omitted material improve independently;
the remaining bias is positive. The fix detects broad off-image material from
geometry and evidence, never a reference ID. Generated unrelated bays and a
slender noisy negative control exercise its activation rule. Full symmetry repeats
one canonical subdivision; cavity policies remain downstream of the exterior.
Branch-trace samples more than 2px outside the filled source fell from 3.84% to
0.33%; the measured trace has 67 segments instead of the former 54.

The source-error run recorded all twenty references. The new repair activates
only on 13 in this catalogue. It does not claim to eliminate existing fitting
errors on the other references. In particular, reference 6 retains its 1,621-cell
scaffold: its excess is primarily a thin contour residual, and a blanket contour
simplification broke delicate connections. That experiment is not shipped.

## Checks

- Static build and configured default suite, including worker imports, client
  coalescing/stale results/fallbacks, stage invalidation, bounded caches, independent
  layers, and export waiting/error rejection.
- All 20 references × symmetry 0/100 × Fill on/off: 80 actual cell/base-cut cases.
  Finite positive 3–6-sided cells, summed area versus actual union, unadjusted cut
  agreement, and exact rotational/bilateral cell symmetry at 100 pass. Maximum
  diagnostic raster disagreement is 2 pixels; reference 13 has zero.
- Reference 13 at symmetry 25/50/75, both Fill states: zero cell/base-cut raster
  disagreement. Generated rotated, asymmetric, cropped, and blank inputs pass.
- Legacy adjusted-output checks on references 3/5, plus tiny/subpixel holes,
  nested islands, selective Fill, largest piece, and hanger/spacing controls pass.
- Shared fitter: all 20 references at detail 50/100 match saved pre-optimization
  output byte for byte, isolated from the deliberate source-topology repair.
  198,141 local trial decisions match full global mesh validation.
- Contour lookup: all 40 frozen reference/detail outputs match, with direct
  nearest-edge/corner ties, tangent correspondence, and shared-evidence scale
  cache checks.

Evidence lives outside deployable assets in the workspace's `structure-diagnostics/`
and `research/optimization/` directories, including the reference 13 whole-flake
and zoom comparison. Tests can run from a complete checkout using the commands
in package.json; photographic suites additionally require the archived fixtures.

## Performance and limits

The exact fitter optimizations reduce reference 6 detail 100 fitting from about 62s
to about 6s in isolated Node observations. Reference 20 fitting fell from about 6s to 2.2s
before the additional contour lookup optimization. These are solver timings,
not browser performance guarantees. The persistent worker keeps computation off
the UI thread and avoids repeated analysis across controls; unchanged visibility
does not run geometry. An active job is not interruptible, so the latest queued
setting waits for it. The synchronous compatibility fallback can block the UI.

For reference 13, keeping the original scaffold budget while retaining cheap
merges reduced the paired cut stage from 4,254ms to 736ms. It keeps 617 rather
than 610 cells, with zero faithful material XOR area or raster difference between
those two subdivisions. A fresh cold-stage observation was 1,244ms. This change
does not relax the original ten-percent budget or the retessellation checks.

For the source-patch repair, partial symmetry transports local photographic
boundaries with corresponding branches; 100% uses one canonical consensus
partition. Exact full symmetry is verified, but continuous contour or cell
topology across 99% to 100% is not guaranteed. Local boundary detail can persist
below full symmetry.

Diagnostic rasterization, VM DOM doubles, Node worker-thread checks, actual browser
interaction, and user acceptance are separate. Browser automation was prohibited;
no browser interaction or device performance test was performed. Release HTTP
verification does not establish interaction QA.
