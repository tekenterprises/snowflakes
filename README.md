# Snowflake Studio

Static, client-side editor with 20 reference flakes: the original ten supplied crops plus ten normalized Bentley photomicrographs. Images are processed in the browser.

## Run and deploy

Use Node 20 or newer and Python 3. `npm run build` validates the static app and all twenty image assets. `npm test` checks reference selection and preview-layer behavior. `npm run dev` serves the app at http://localhost:8787. The editable application source is in `dist/`; it is served directly without a bundler.

For a **new** Cloudflare Worker, connect `tekenterprises/snowflakes` in Workers Builds, select `main`, set the build command to `npm run build`, and the deploy command to `npx wrangler deploy`. Use Worker name `snowflake-studio` to match `wrangler.jsonc`; choose another unique name in both places if that name is already in use. No existing Cloudflare Worker is targeted or configured by this repository. Static files are served from `dist/`; there are no account IDs, zones, DNS routes, custom domains, storage bindings, or credentials in the configuration. Connecting the repository is a separate account setup step.

## Reference library (v24)

All twenty references are accessible from the thumbnail strip. References 11–20 use the final approved selection, including Bentley 1018 at 17, 542A at 18, 591 at 19, and 332 at 20. Each is loaded from its individual image, so selecting a new reference cannot crop the wrong cell from an older sheet. Uploads still support a single photograph or a 5 × 2 sheet, with thumbnails generated from the uploaded sheet itself. `dist/references.js` holds the catalogue and source URLs; `dist/sources.html` provides photo credits. The reconstruction algorithms are unchanged.


## Tracing and preview

The compact interface keeps the version beside the title. Crystal geometry is an on/off checkbox (trace or full polygon fitting); detail and symmetry remain sliders. Every slider has its own full-width row. Alignment controls and explanations are collapsed by default.

The original cut trace uses a 768 px artboard with thresholding, hole filling, component filtering, detail reduction, offset and rounding. Preview bounds include both the image subject and cut shape without changing export dimensions. Vector, Branches, Image, and Crystal geo are independent layer buttons. Any nonempty combination is allowed; the last visible layer cannot be switched off. Crystal geo displays polygon guides even when the separate “Use crystal geometry for cut” checkbox is off. Layer selection never changes the exported cut.

## Image → shared structure → polygons (v27)

`branch-structure.js` remains the image-only candidate detector. At up to 384 px, it measures six trunk axes and follows image geodesics, grayscale ridges, paired edges and medial clearance. Continuous junction searches locate each child on its parent. The detector rejects crossing lines and duplicate terminal edges. No reference numbers, annotated coordinates or specimen-specific corrections enter runtime code.

`branch-tips.js` recovers hollow or weakly connected terminal caps from bounded original-image evidence before template matching. Competing branch axes constrain the recovery; new cap filling cannot seal a large inter-arm opening. High thresholds retain faint evidence without using faint closed connections to fill large background regions.

`structural-model.js` builds one half-arm framework from those observations. Ordered sequence matching preserves attachment order and one-to-one correspondences. After forming the template, a second association pass revisits all original candidates so good observations cannot be stranded in discarded clusters. Primary slots require broad support; shorter distal features can qualify with fewer observations across multiple arms. Missing instances get bounded searches in the original image, constrained by existing branches and distinct tips. Each instance keeps an observed/inferred status and evidence score (not a calibrated probability).

Every arm and its reflected side receives the same slot hierarchy. Local image measurements supply attachment position, angle and length. Joint constraints resolve crossings: first adjust a junction along its own parent while retaining the tip; unsupported predictions stop before an obstruction when no supported junction works. A separate common-template constraint pass prevents independent medians from crossing. This remains an interpretation: unique damaged or extra features may not enter the common framework.

Detail selects branch slots globally. Symmetry changes local geometry toward the common measurements, without adding, deleting or fading branches. At full symmetry, the graph and corresponding polygons have exact rotational and reflection counterparts. Intermediate fitting also checks for crossing lines. The symmetry axis remains the circular mean of six measured trunk directions.

`branch-regions.js` measures image-width profiles on the corrected branch scaffold. `shared-mesh.js` uses the matched profiles from all six arms and both sides to build one half-arm partition. Convex 3–6-sided cells are clipped against the core and previously allocated material, so their interiors do not overlap. The half-arm is mirrored and rotated twelve times; corresponding cells retain identical identities, counts, side counts and connectivity. Shared vertices can move toward each arm's measured branch positions and widths, subject to convexity and intersection checks. If an additional facet is needed for local deformation, that definition is added to every corresponding half-arm, not only to the difficult image region.

At full symmetry the cells are exact rotated/reflected copies. At lower settings the same mesh deforms toward the image. Collinear T-junction groups are flattened, and remaining cyclic affine constraints are solved once as weights on free vertices. Cut boundaries are stitched from shared edge identities with matching subsegments on both sides. This prevents independent vertex motion or coordinate rounding from opening cracks. The central hexagon remains one six-sided cell.

The geometry is a compact structural interpretation, not a claim to recover every physical crystal facet or every contour pixel. Crystal Detail at 50% reproduces the v26 maximum. The lower half selects common branch slots and compact subdivisions; 50–100% tightens measured-profile error and permits deeper adaptive subdivisions to retain smaller notches and tips. Flat regions do not subdivide simply because the slider increases. Raw non-crystal trace detail keeps its existing range. Fewer faces deliberately smooth small outline features; source pixels, branch overlays and the raw trace remain available for comparison. `shared-polygons.js` retains the registered raw-profile trace used by non-crystal symmetry; its previous strip fitter remains available for diagnostic tests.

`crystal-core.js` searches central hexagon scale, orientation and small center offsets against grayscale edge evidence on all six sides. It supplies an explicit six-sided hub to the polygon union. A uniformly dark center cannot qualify as a detected hexagon. Faint/ambiguous cores use a conservative inferred hub, reported in Details & help. At full symmetry the core shares the flake's center and compatible orientation.

Non-crystal symmetry uses all measured profile samples on corresponding branches before averaging their widths. It does not first average unregistered silhouette distance fields, which erased fine branches with different local positions. The zero-symmetry cut remains the original trace. Intermediate settings blend toward the registered trace; the full setting enforces exact sixfold vector symmetry.

Source analysis, corrected branch ownership and per-detail mesh templates/calibrated poses are cached separately from symmetry interpolation. Geometry remains a checkbox; changing guide visibility never changes the reconstruction or hanger axis. The geometry-intensity API still supports signed-distance blending for existing integrations/tests.

The shared mesh stitches its cut boundary by vertex/edge identities, avoiding cracks from independently rounded unions. Clipper remains responsible for legacy unions and downstream cut operations on a 0.0001 artboard-pixel integer grid. Spacing and rounding operate afterward. `exact-symmetry.js` enforces final rotational/reflection symmetry, including after those adjustments. `cut-output.js` applies hole filling and largest-component selection to the final vector topology, after precise polygon fitting and final symmetry. This catches even subpixel union holes without rasterizing the exact edges. Preview and SVG use the same cleaned boundaries. Only closed cut boundaries enter the millimeter SVG; blue centerlines and gold model polygons are preview guides.

`cut-features.js` closes gaps with round vector offsets (dilation then erosion, using half the requested gap width). Largest-component selection follows closing so nearby fragments can join first. The optional hanger is applied after closing, filling and symmetry: a circular rim beyond the top arm, joined by a round neck, then its opening is subtracted. The final arm axis intersects the finished outline to locate the attachment; an extremal outline vertex is never used when that axis is available. Diameter, rim thickness and neck length use artboard millimeters. Neck length measures from the flake tip to the nearest edge of the opening, independent of rim thickness; at zero, the opening is tangent to the original tip. The opening is placed outward along the arm axis and is not repeated by symmetry or removed by hole filling. If it cannot fit on the artboard, export is blocked with a request to reduce source scale or hanger dimensions.

These are image interpretations, not measurements of physical crystal facets. Faint, touching and subpixel twigs can still be missed or misclassified. Mask overlap is not a confidence score. There is no kerf compensation or minimum-feature certification.

The older contour fitter in `crystal.js` supplies reusable raster/area helpers. Vendored libraries retain their licenses: Earcut (ISC), polygon-clipping (MIT), Clipper (Boost), and its bundled JSBN notices.

## Verification

Node and Pillow are required for the fixture preparation scripts:

```
python tests/prepare.py
python tests/prepare-image.py
python tests/prepare-thresholds.py
node test.cjs
node tests/faithful.cjs
node tests/symmetry.cjs
node tests/crystal.cjs
node tests/image-crystal.cjs
node tests/branch-measurements.cjs
node tests/branch-stability.cjs
node tests/polygon-sides.cjs
node tests/shared-mesh.cjs
node tests/crystal-detail.cjs
node tests/branch-regions.cjs
node tests/branch-controls.cjs
node tests/rooted-tree.cjs
node tests/final-symmetry.cjs
node tests/symmetry-axis.cjs
node tests/preview-independence.cjs
node tests/cut-output.cjs
node tests/cut-features.cjs
node tests/shared-structure.cjs
node tests/image-evidence.cjs
```

The branch-measurement tests use known angles, non-discrete lengths, solid/outlined branches, genuine Y forks, short outlined branches, rotated inputs, 37 translated/resized/rotated versions of the ambiguous fern twig, and manually selected tips in the supplied needle and fern. They test geometry/graph independence, terminal-duplicate suppression and broad-plate corner rejection. Other checks cover all ten references, graph connectivity/crossings, intermediate detail/symmetry, and final exported edge symmetry after spacing/rounding. Geometry overlays were rendered for visual inspection; browser and phone interaction QA were unavailable in this execution environment.

The shared-structure suite checks all ten references at three detail levels and five symmetry settings: common IDs, branch hierarchy, polygon counts and side definitions, noncrossing lines, core geometry, and reflected polygons. It also checks the known fern twig through the complete new pipeline on all 37 transformed fixtures, smaller annotated tips, central-edge detection versus uniform material, and lateral hanger alignment in both geometry modes. See [the research/preparation notes](docs/structural-reconstruction-plan.md).

The v23 regressions cover five terminal caps and an open background gap at thresholds 217/245, a fine width feature present on just one of twelve corresponding profiles, registered fine-dendrite symmetry, and all 15 nonempty layer combinations. The fork test also exercises cap recovery. Reference overlays use Pillow resampling and are diagnostic approximations of browser pixels; browser/phone interaction QA remains unavailable.

The shared-mesh suite independently checks polygon intersections with Clipper, equal bilateral/radial branch and cell definitions, stable vertex IDs across symmetry settings, one connected cut exterior, and exact reflection/60-degree rotation. The fixture-free mesh test also checks acyclic junction dependencies and that zero symmetry uses the fitted pose without an unintended fallback.
