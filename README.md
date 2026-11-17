# Snowflake Studio

A browser-local snowflake reconstruction editor with 20 photographic references
and laser-cut SVG export. Uploads and processing stay in the browser.

## Run and deploy

Use Node 20 or newer and Python 3. `npm run build` validates maintained static
source and assets in `dist/`; there is no bundler. `npm test` runs the default
regressions. `npm run dev` serves the editor at http://localhost:8787.

The existing Cloudflare Worker is `snow-wizard`, configured by `wrangler.jsonc`.
Follow [deployment instructions](docs/DEPLOYMENT.md) to publish an authorized
release to the existing app. Preserve its account, routes, and access settings.

## Reconstruction (v37)

The approved prototype now supplies the default center, straight trunks, nested
central hexagons, median half-arm branch framework, individual side fits, and
connected crystal cells. It analyzes fresh image pixels without catalogue-specific
geometry. The actual crystal-cell union defines the base cut, including holes.
See [engine stages and contracts](docs/reconstruction-engine.md). Bounded caches
reuse completed flakes; helper workers parallelize local branch fitting and
material preparation. [Performance validation](docs/validation-v37.md) separates
cold processing from cached returns and records the remaining latency limits.

Vector, Branches, Image, and Crystal geo independently control visibility. At
least one layer remains visible. “Use crystal geometry for cut” separately chooses
the cut representation. Detail adjusts facet simplification; symmetry blends toward
one repeated canonical half-arm. Offset, rounding, gap closing and the hanger are
later manufacturing adjustments. SVG export waits for the latest completed result
and contains closed final cut boundaries in millimeters.

All 20 references remain selectable individually. Uploads support one photograph
or a 5×2 sheet. References 11–20 are normalized Wilson A. Bentley photomicrographs;
[photo credits](dist/sources.html) record provenance. These are artistic image
interpretations, not physical facet measurements or minimum-feature certification.
There is no kerf compensation.

Vendored Earcut (ISC), polygon-clipping (MIT), and Clipper (Boost) retain their
licenses. Legacy geometry modules remain available for regression coverage and
reusable raster/manufacturing helpers; they are not the default reconstruction.
