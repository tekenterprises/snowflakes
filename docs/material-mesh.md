# Crystal cells and their cut perimeter

Crystal cuts are faceted artistic interpretations. Simple crystals should retain
simple outlines; finer detail belongs where the photographed structure supports
it. Numerical agreement with every noisy contour point is not the objective.

The branch scaffold retains shared radial/bilateral cell definitions. Balanced,
full-resolution photographic boundary fitting supplies exterior vertex goals.
The constrained fitter preserves convexity, shared edges, and non-overlap.
Coordinated feature refinement is bounded so cell counts remain near the baseline.

A shared scaffold can have the wrong topology for an irregular photograph: an
open bay may be bridged by a face, so moving its existing vertices cannot restore
the opening. The source-patch fallback detects this from the actual faithful
scaffold and full-resolution fitted source outline. It requires excess material
above 6% of source area, including at least 1.5% more than three artboard pixels
outside the source (scaled from 768px). At least a quarter of the excess must
be this broad material. A long thin residual along intricate branches is not
evidence of a bridged bay; such shapes retain their shared scaffold. The repair
does not increase tolerance and sacrifice thin necks to meet a cell budget.

For those broad mismatches, convex envelopes of existing physical branch groups
guide a new partition of the supported material. The fitted central hexagon stays
intact. Triangulation and convex merging produce real 3–6-sided cells, retaining
branch slot and source-cell provenance. Remaining supported material receives
cells owned by the nearest branch. The final perimeter is traced from their
normalized shared incidence; it is not an independent preview clip or cut mask.
Local patch subdivisions can differ when observed bays require it. Full symmetry
partitions one canonical half-arm and repeats its subdivision twelve times.
Newly enclosed consensus bays remain structural exclusions rather than being
filled as accidental scaffold holes. Intermediate symmetry transports the source
boundary with corresponding branch poses. In faithful mode, the branch preview
uses the measured graph when the common scaffold needed this fallback.
The fallback does not guarantee continuous contour or cell topology between
99% and 100% symmetry: local photographic boundary detail persists below full
symmetry, while 100% uses the canonical consensus partition. Exact full symmetry
is verified separately from interpolation continuity.

Cavity refinement retains the original scaffold's cell budget after a source
repair. Cheap coordinated and local merges still aim for 110% of the smaller
repaired partition. Costlier branch-patch retessellation is only needed above
110% of the original scaffold count. This distinguishes a compacting goal from
the allowed complexity budget; reducing the source partition does not create
a new requirement to spend seconds removing a handful of already affordable
facets. All cavity, topology, actual-union, and numerical tolerances are unchanged.

The cut exterior belongs to these cells. The former independent image silhouette
no longer replaces their perimeter, and preview cells are displayed directly.
Supported cavities are carved into real cells, decomposed into convex 3–6-sided
fragments retaining parent branch/cell provenance. Local cavity occupancy may
change active counts because faithful arms need not contain identical holes. Prefer
matching subdivisions; use local differences only around cavity-adjacent patches
or source-supported open bays when needed for compact facets. At full symmetry, fit and subdivide a canonical
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

`node tests/source-patches.cjs` uses generated shapes unrelated to the catalogue
to check that broad unsupported bays reopen, the central hexagon and branch
ownership survive, cell area matches the actual union, and full symmetry repeats
one subdivision. Photographic source-error checks must report added and omitted
material separately; cell/cut agreement alone cannot detect a faithful but wrong
scaffold.

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
