# v34 validation and limits

Baseline: GitHub `d6612786ae7193e41ae090d17dc642d16411334e` (v33).
Verified on 2026-11-15 with Node24.22.1. This records source validation, not a
claim of successful live deployment.

## Completed checks

- Static asset validation (`node scripts/check-static.cjs`).
- All ten configured default suites, invoked through Node because npm was not
  on PATH. Includes independent generated rotated, asymmetric, cropped, and
  blank images, actual cavity cells, and artistic cavity-facet fitting.
- All twenty archived photographic fixtures at symmetry0/100 and Fill on/off:
  80 combinations. Positive finite3–6-sided actual cells, cell-area/perimeter
  agreement, raster agreement, and actual-cell rotational/bilateral symmetry at
  full symmetry passed. The largest raster discrepancy was4 of589,824 pixels;
  comparisons use subpixel vector tolerances rather than matching pixel ties.
- `tests/cut-output.cjs --refs=3,5` through the fixture adapter: selective Fill,
  topology, partial/full geometry, symmetry, offset, rounding, and exported paths.
- `tests/cut-features.cjs` through the fixture adapter: gap joining, hanger neck,
  physical hole dimensions, fill/symmetry interactions, and material preservation.
- Architectural review checked reference20 at symmetry0/25/50/75/100, common
  nominal roles, full-symmetry transforms, compatible local triangulation, and
  injected failure of an optional feature operation. Invalid optional refinements
  retain the preceding valid geometry.
- Wrangler4.148.0 deployment dry-run:54 static assets, valid `snow-wiz` config.
- Whitespace/conflict review and inspection for specimen-specific runtime rules.

The final photographic records are workspace diagnostics under
`../research/compact-review/`, outside the repository, alongside reproducible
before/after renders. Fixture binaries remain outside the repository. The
committed test scripts accept `SNOWFLAKE_FIXTURES` for other environments.

## Interpretation and limitations

The base crystal cut is derived from actual cells. Offset, rounding, gap closing,
and hanger are deliberate subsequent manufacturing operations. Crystal guides
and a non-crystal cut can also differ intentionally when that cut mode is selected.

Cell count is kept compact through bounded shared refinements and local cavity
repartitioning. A uniform10% final-count ceiling is **not** achieved. Some
cavity-heavy cases, especially5/14 and Fill-off noisy plates, require more cells
than v33's nominal count. That old count excluded subdivisions hidden by clipping;
it did not count valid3–6-sided visible cells around the holes. No claim of equal
counts across all images/settings is made. Simple filled plates3/9 remain61/73
cells; reference20 is1,370 actual faithful cells versus1,237 old nominal cells,
with the previously omitted stub now included in real geometry.

Small cavity-facet differences are permitted locally, with provenance retained.
Full symmetry uses canonical subdivision and replication to eliminate those
differences. Boundary/void fitting remains an artistic interpretation; automatic
structural-hole classification remains heuristic.

No browser automation or interaction QA was performed, per the user's instruction.
DOM doubles, generated images, photographic fixtures, and diagnostic renders are
distinct evidence. Tests do not establish physical laser/material suitability or
support for every possible photographic input; unsupported branch structure has
an explicit fallback status.

## Reproduce

```powershell
node scripts/check-static.cjs
npm test
node tests/crystal-material.cjs --refs=1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20 --symmetric
node tests/run-with-fixtures.cjs tests/cut-output.cjs --refs=3,5
node tests/run-with-fixtures.cjs tests/cut-features.cjs
```
