# Structural reconstruction review — 2026-11-11

Baseline: v21, commit `83b2aa72a441887c2201525b0874d0365da802f0`.
The user initially requested preparation only, then authorized implementation.

## Findings

The detector measures each arm independently. `BranchStructure.consensus` clusters observations afterward; it cannot search the photograph again where another arm suggests a missing branch. At partial symmetry, unmatched branches shrink while consensus branches grow. This changes branch counts with the symmetry setting. Detail also prunes each independently measured branch by its own length.

`BranchRegions.pieces` independently splits each width profile. The existing 3–6-side limit is real, but corresponding branches have neither common subdivision locations nor common vertex roles. At full symmetry, arm zero's polygons are copied around the center; lower settings do not retain that correspondence. There is no explicit central hexagon model.

Read-only baseline measurements use the existing 768 px Pillow fixtures (threshold 230, source scale 90%; an approximation of browser rendering). On reference 02 at detail 100, polygon counts per arm are `110,125,107,123,120,99` at symmetry zero; `82,86,76,81,79,65` at 50; and six copies of 54 at 100. These are fitting counts, not observed physical facets. All ten fixtures show changing polygon definitions with symmetry.

The hanger uses a single minimum-y outline vertex, with an x-distance tie break. It receives no branch-axis information. A second approximate reference-09 fixture using the screenshot's threshold 245 and scale 100 reproduces the lateral mismatch: with full symmetry, the hole is about 0.07 mm left of the extrapolated branch axis in trace mode and 0.71 mm left in geometry mode. Its x coordinate equals the selected highest vertex, not the axis intersection. This confirms an attachment-policy defect in the current code, but these numbers are not measurements of the screenshot. Rasterization and flat/chamfered caps can move that extremal vertex even when the outline is reflected exactly about the branch.

## Research and design decisions

- [Libbrecht, Snowflake Science](https://www.snowcrystals.com/science/science.html): similar growth conditions explain related arms; actual snowflakes can have irregular branches. Use a shared structural prior, with image evidence and uncertainty, rather than treating equal counts as a universal physical law.
- [Steger, 1998 thesis](https://mv.in.tum.de/_media/members/steger/publications/1998/diss-1998-steger.pdf): line-profile models, scale, and asymmetric intensity profiles matter for locating centerlines. Preserve both ridge and paired-edge evidence; a dark outline alone is not a stem. A complete Steger detector is not necessary for the first implementation.
- [Felzenszwalb and Huttenlocher, Pictorial Structures](https://cs.brown.edu/people/pfelzens/papers/blobrecJ.pdf): jointly score part appearance and allowed deformation, with explicit parent relationships. Ordered matching and bounded local searches are appropriate here. Coupling twelve half-arms does not inherit the paper's global-optimum guarantee for a single tree.
- [Cootes et al., Active Shape Models](https://research.manchester.ac.uk/en/publications/active-shape-models-their-training-and-application/): retain corresponding landmarks while allowing constrained local deformation. Borrow that principle; six arms are not an adequate training set for a general learned shape model.
- [OpenCV Hough transform documentation](https://docs.opencv.org/4.x/d9/db0/tutorial_hough_lines.html): line evidence can propose hexagon edges. Six detected lines alone do not establish a central crystal boundary; require central location, closure, material support and multi-edge evidence.

## Implementation contract

1. Keep the existing image-only detector as a candidate source. Match ordered children in parent-relative coordinates, one observation per slot per side. Build one canonical half-arm tree using evidence from all six arms; do not count both sides of one arm as independent arms. Use robust aggregate measurements.
2. Instantiate that tree on both sides of all six arms. Revisit the original image in bounded neighborhoods for missing slots. Keep confidence and observed/inferred provenance. Preserve supported local angles, lengths and attachment locations. Never introduce reference-number or image-coordinate exceptions.
3. Separate structure from symmetry. At a fixed detail level, branch and polygon identities/counts remain fixed across symmetry values. Zero symmetry retains local image fitting within the common framework; full symmetry uses exact reflected/rotated geometry. Detail selects a shared subset of branch slots and a shared polygon subdivision schedule.
4. Recompute image ownership after branch placement. Fit corresponding branches together: common split intervals and common vertex roles, each piece having 3–6 genuine sides. Positions and widths vary locally. Build consensus polygons from corresponding measurements, not from whichever arm happens to be first. Avoid independently choosing side counts and attempting to reconcile them afterward.
5. Fit an explicit six-sided central plate from image-edge evidence. Search scale and phase near the common center; score support on all six edges. Keep a conservative inferred hexagon when no central boundary is resolvable, and identify that state in diagnostics. Connect arm material to the hub; polygon guide seams are never separate SVG cuts.
6. Pass the selected top arm's axis to the hanger stage. Intersect that axis with the final flake boundary, then measure neck length along it from the boundary to the opening. Add the rim and opening after symmetry, closing and filling. Use the same result for preview and export.
7. Preserve the compact controls, version next to title, millimeter dimensions, gap closing and final hole cleanup. Cache source analysis separately from symmetry interpolation. Keep the interaction responsive without adding a server or model dependency.

## Validation gates

| Area | Required checks |
| --- | --- |
| Correspondence | Equal ordered slot IDs, parent relationships, polygon counts and per-piece side counts across corresponding sides/arms at symmetry 0, 25, 50, 75 and 100. |
| Image fidelity | Existing annotated needle/fern tips and ambiguous twig; no double-tip branches or connecting jumps; inspect overlays for all ten references. |
| Detail | Shared structural pruning and polygon simplification; detail changes complexity, symmetry does not change identities. |
| Symmetry | Test branch endpoints, individual polygons and final outline under 60-degree rotation and arm reflection. Exclude the intentionally single hanger. |
| Hub | Six nondegenerate sides, positive area, center contained, image-edge support where available; explicit inferred status for faint cores. |
| Hanger | Center on final top-arm axis in both geometry modes; physical hole/rim/neck dimensions; translated, rotated and flat-cap examples; geometry/guide visibility cannot change the attachment. |
| Topology | One connected exterior when requested; no unintended internal paths after filling; intentional hanger opening survives. |
| Generalization | Translated/rescaled/rotated fixtures, synthetic missing/extra branches, pale centers and outlined branches. No runtime fixture coordinates. |

The supplied sheet originated in a GPT chat. These fixtures can validate consistency and regressions; they do not establish performance on diverse microscope photographs. True damage and uniquely occurring extra branches require explicit observed/inferred handling rather than an unconditional claim of faithful reconstruction.

## Order of work

Implement common branch correspondence and image refinement first, then shared polygon fitting, then the image-fitted core and semantic hanger attachment. Run focused regression tests after each stage and the existing relevant suite on the integrated result. Inspect diagnostic overlays before publishing. Browser QA depends on the managed browser capability being available; algorithm tests do not substitute for phone interaction testing.

## Implementation and validation record

The v22 implementation adds `structural-model.js`, `shared-polygons.js`, and `crystal-core.js`. It retains the existing detector as its candidate source. An initial ordered correspondence pass is followed by reassociation against the completed template; this second pass was necessary to retain the reported fern twig under subpixel translation. Local image searches reject competing branch tips and crossing lines. Junction constraints and a separate common-template feasibility pass address crossings introduced by averaging. Unsupported extents carry inferred status.

The joint polygon fitter uses shared cross-section intervals and explicit vertex roles. It does not claim to recover physical internal facets. Corresponding definitions stay fixed across symmetry values, including at zero; detail changes the common subdivision schedule. The core detector requires contrast on multiple edges and rejects a uniform dark region as an observed hexagon. The hanger now intersects the final arm axis with the final cut boundary.

`tests/shared-structure.cjs` passes all ten references at detail 0/50/100 and symmetry 0/25/50/75/100, checking matched definitions, connected topology, noncrossing branches and full reflection symmetry of individual polygons. All 37 fern transformations preserve the specific reported twig through the complete new scaffold. The smaller annotated fern tips, synthetic detected/inferred core cases, and hanger axis/neck checks pass. Existing trace, branch measurement, polygon side/anchor, final symmetry, gap closing, hole cleanup and export tests also pass.

The final ten-reference overlays were visually inspected at symmetry 0 and 100. As an example of the new invariant, reference 02 has 114 branch instances and 1,207 pieces at both settings at detail 100. The extra subdivision at high detail is shared across instances; it is not a count of physical facets. Reference 09 has six trunks and 169 pieces at both settings; the previous independently detected side branches on its broad blades do not enter the common framework.

Managed browser QA is unavailable: this session exposes no browser/desktop control tool or `cua_repl.js` entry point. Static dependency checks, DOM orchestration tests and rendered algorithm overlays were used instead. No phone interaction or browser-rendered pixel equivalence is claimed. The Sites workflow helper is also absent from the installed plugin filesystem, so source synchronization/publication requires the native repository credential and an explicit Git/archive fallback.

## v26 mesh review and implementation

The v25 profile fitter represented each branch as overlapping strips; independently partitioning the improved prototypes removed overlaps but lost polygon correspondence. The branch template already has the required bilateral/radial identities and is retained.

The new representation separates topology from coordinates: fit one half-arm from corresponding measured profiles, subtract already allocated regions, and instantiate its planar mesh twelve times. Vertex correspondence follows the active-shape-model principle described above; constrained group/vertex moves retain convex cells and reject intersections. This is a bounded geometric optimizer, not a claim of global optimality. Common face refinement applies to all twelve instances.

A planar partition alone is insufficient: partially overlapping collinear edges can introduce cyclic T-junction dependencies, and rounding unsplit shared edges can create SVG cracks. Collinear constraints are flattened onto extreme endpoints. Remaining strongly connected affine junction groups are solved by elimination into weights on free vertices, so calibration cannot silently invalidate distant faces. Export stitches shared edge identities with identical subdivided segments on both sides. Numerical validation includes independent pair intersections, aggregate area, connected exterior, and exact mirrored/rotated counterparts.

The old 95% pixel-mask agreement test between fine raw tracing and crystal polygons is replaced by explicit shared-skeleton coverage: a compact facet mesh intentionally differs from a dense pixel contour. Existing annotated cap retention, open-background, zero-symmetry trace, final symmetry and hole-cleanup checks remain in place.

Final v26 validation passes all ten original references at detail 0/100 and symmetry 0/50/100, including independent intersection checks, matching face identities and side counts, valid calibrated poses, and connected cut exteriors. Three additional photographic references also pass the mesh checks. The high-threshold cap/background regressions, final hole cleanup and physical hanger/export tests pass. The inspected plate, fern and fine-dendrite examples contain 37, 385 and 889 cells respectively at maximum detail; these are geometric partitions, not inferred physical facet counts. Browser interaction QA remains unavailable in this environment.

## v27 extended crystal detail

The public crystal-detail range now maps 0–50% to the previous 0–100%. The upper half keeps the complete branch scaffold and tightens measured-profile area error, allows one additional adaptive split depth, and reduces the minimum split span. The 3–6-side limit, common half-arm definitions, central hexagon and conforming cut boundaries are unchanged. Non-crystal tracing retains its prior detail mapping.

The extra range exposed a latent convexity-check defect: all adjacent turns can be positive in a self-intersecting pentagram. Both global and local fitting now require every vertex to lie within every oriented edge. A synthetic regression rejects that case, and independent Clipper intersection checks cover the extended mesh range.

Validation: build and default tests pass, including the pentagram regression. All ten original references pass independent intersections, shared definitions, connected exterior and exact full symmetry at detail 0/50/75/100 and symmetry 0/50/100. The image-evidence regressions pass at both tested thresholds. At 50% → 100%, the plate has 37 → 61 cells, fern 385 → 781, and fine dendrite 889 → 1,621, with improved image-mask agreement on all three. Initial pre-change coordinate hashes verified that 50% reproduces v26 maximum-detail output for those three references. Higher detail costs additional fitting time; no browser interaction QA was available.
