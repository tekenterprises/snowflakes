# Crystal cells and their cut perimeter

Crystal cuts are faceted artistic interpretations. Simple crystals should retain
simple outlines; finer detail belongs where the photographed structure supports
it. Numerical agreement with every noisy contour point is not the objective.

The branch scaffold retains shared radial/bilateral cell definitions. Balanced,
full-resolution photographic boundary fitting supplies exterior vertex goals.
The constrained fitter preserves convexity, shared edges, and non-overlap.
Coordinated feature refinement is bounded so cell counts remain near the baseline.

The cut exterior belongs to these cells. The former independent image silhouette
no longer replaces their perimeter, and preview cells are displayed directly.
Supported cavities are carved into real cells, decomposed into convex 3–6-sided
fragments retaining parent branch/cell provenance. Local cavity occupancy may
change active counts because faithful arms need not contain identical holes. Prefer
matching subdivisions; use local differences only around cavity-adjacent patches
when needed for compact facets. At full symmetry, fit and subdivide a canonical
half-arm once and repeat it, eliminating local variation.

Offset, rounding, gap closing, and the hanger are subsequent manufacturing
operations; those can deliberately differ from the base cell perimeter.

The nominal scaffold overlap metric was removed from the UI because it did not
measure the final cut. The interface reports the actual displayed material cells.

## Verification

`node tests/crystal-material.cjs --refs=20` checks actual cell/cut agreement,
positive finite 3–6-sided cells, and Fill states using the archived fixture.
Use `--refs=1,2,...,20` for all references and `--symmetric` for zero/full symmetry.
Set `SNOWFLAKE_FIXTURES` to the fixtures directory; by default the workspace's
`fixtures/` is used.

Historical photo suites can run with their original `/tmp/` reads redirected:

```powershell
node tests/run-with-fixtures.cjs tests/cut-output.cjs --refs=3,5
```

The adapter changes only fixture path resolution. It does not alter fixture bytes.
Diagnostic renders and mathematical checks are distinct from browser QA. Older
material-reference accuracy assertions describe v33's independent outline and must
not be weakened or presented as evidence for the new cell-derived shape.

## Rejected experiment

An exact overlay of twelve photographic contours produced about25,000 cells on
reference20. It was rejected because it sacrificed structural clarity and inflated
complexity. Its source is retained outside the application checkout under the
workspace research directory; it is not included in the shipped scripts.


Cavity outlines are faceted artistic fits. Generic simplification preserves
material-component and closed-hole counts using vector topology checks, bounds
area and centroid changes, and leaves narrow connections intact. Convex merging
and bounded branch/junction patch retessellation preserve actual material while
removing unnecessary internal subdivisions. None of these operations uses a
catalogue ID or specimen coordinates. Generated rotated, asymmetric, cropped,
and blank uploads are exercised by `tests/crystal-upload.cjs`.
