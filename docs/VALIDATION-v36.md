# v36 reconstruction migration validation

## Scope and provenance

Source baseline: `771a6e1f413d5b946516fb1a90077cebc43ffe32` (v35).
The browser migration ports the approved center/trunk/hex v6, full-slice median
branch v16, local fitter v6, median crystal v6 and full crystal v4 prototype
algorithms. Saved results are test oracles only; runtime reconstructs fresh pixels.
Unrelated local edits were preserved and excluded from the staged release tree.
The release candidate is exported from the Git index, not the dirty working copy.

## Automated geometry evidence

- Framework: all 20 original RGBA hashes verified; exact centers, ring counts,
  inferred flags and center scores. Maximum trunk coordinate drift 2.90e-13px;
  maximum hex coordinate drift 1.28e-13px.
- Branches: all 20  / 68 shared slots  / 816 local axes match the accepted framework,
  statuses and source tips; maximum geometry drift 7.31e-13px.
- Fresh faithful crystals: all 240 sides,20 connected whole-flake assemblies;
  finite positive 3–6-facet cells, finite branch/trunk/hex support, shared edge
  incidence and actual union/cut agreement. Maximum overlap residual 0.0001433px².
- Main engine: all 20 at symmetry 0/50/100 plus Fill off / Detail 50 checks on 2/13/18
  passed actual union, cut equivalence, facets, supports and connectivity. Maximum
  rotational/reflection area residual before the final seam correction0.001620px²
  against an unchanged 0.01px² numerical tolerance.
- Six fresh transformed/inverted reference 20 upload cases passed the same checks.
- A final regular-domain repair extends supported image samples across the
  half-arm crop seam before exact clipping and classifies seam-enclosed cavities
  with the existing white-evidence rule. This removes false holes on photographed
  material in the actual cells. Fresh reference 3 has zero holes; reference 14
  retains six supported holes. Faithful geometry is unaffected.
- Final seam-corrected full symmetry: all 20 actual union/cut, support, facet,
  incidence and connectivity checks pass. Independent image probes found no
  remaining hole lying wholly on photographed material. The 78 remaining holes
  derive from supported white cavities; fitted rims include gray edge pixels.
- Real reference 18 checks exercise source-cut visibility independence, Fill/detail
  cache order, exact full symmetry, and manufacturing symmetry around the fitted
  center rather than an assumed midpoint. Vector area comparison is used because
  raster edge ties can differ even for equivalent vector geometry.

All checks compare actual cell unions and actual cut boundaries, including holes.
They do not establish physical crystal-facet measurement or manufacturing safety.

## Fidelity and visual review

Whole-flake source/faithful/50%/100%/median sheets for all 20 and close views of
20/3/9/18/19 were inspected. Diagnostics remain outside deployable assets in
`structure-diagnostics/runtime-port/integration/final` in the development workspace.
Input and code hashes accompany those artifacts.

Photo fidelity was measured independently as added and omitted pixels and signed
area bias. Raw threshold comparisons include intentionally filled bright interior
texture; filled-silhouette comparisons separate exterior disagreement. Against
approved v4, the largest signed exterior-area change is 445px² (reference 6).
Contour XOR is a different measure: reference 6 changed 1399 added / 1844 omittedpx²,
about 3.27% of its approved area. The migration preserves the approved artistic
interpretation; tiny noise and photograph shadows are not physical boundaries.

Cold analysis measured roughly 9–12seconds/reference; crystal geometry about
0.45–6.9seconds on the development host. These are Node measurements, distinct
from browser timing. Manufacturing-only changes reuse fitted geometry. Bounded
quality searches can choose different valid internal subdivisions under different
CPU scheduling; geometry contracts are checked before results reach the UI.

## Browser and release checks

The actual editor was exercised locally with crystal/source cuts, independent
layers, reference switching, faithful/full symmetry and difficult references 12,
14 and 17. No browser warnings/errors were captured in those checks. The real
reference 17 SVG download was parsed: 100mm artboard, 15211 bytes, one closed contour.
The browser download helper stalled before completing; automated export freshness
checks and the downloaded artifact are recorded separately from visual inspection.

The staged candidate's static build and all 22 configured default suites passed
before commit/deployment. Live deployment identity and asset-byte verification are
recorded in `DEPLOYMENT.md` after publication.
