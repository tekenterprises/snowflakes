# Snow Wizard — project guidance

Snow Wizard develops Snowflake Studio: a browser-local snowflake reconstruction
editor and laser-cut SVG exporter. These instructions apply to this workspace.

## Working agreement

- Inspect relevant code, inputs, tests, and current Git state before consequential
  changes. Preserve unrelated behavior, user edits, photographs, and evidence.
- Review/diagnose means inspect and report; prepare/plan means produce a concrete
  proposal; implement/build/fix means carry the requested change through suitable
  verification. Honor combined requests and explicit research/release stages.
- Continue authorized work without repeated permission requests. Resolve routine
  choices yourself; surface decisions that materially change product behavior,
  geometry requirements, data meaning, or scope.
- Other projects' instructions and historical handoffs are context, not standing
  authorization here. Do not import their deployment or model-selection policies.
- Keep changes cohesive. Reuse existing geometry tools and interfaces; explain
  non-obvious algorithms, units, tolerances, and failure behavior. Avoid unrelated
  reformatting, speculative frameworks, and specimen-specific runtime patches.

## Subagent delegation

- Use GPT-6 Luna for small, clearly bounded supporting tasks, such as a focused
  code inspection, fixture check, or narrowly scoped test. Use GPT-6.1 Sol for
  harder supporting analysis, implementation, or review requiring more context
  and linked reasoning. Delegate when it meaningfully helps; keep trivial work
  local rather than creating coordination overhead.
- Keep architecture decisions, integration ownership, and final verification
  with the lead agent and GPT-6 Astra. Use Astra for consequential architectural
  review when needed; supporting agents do not independently change the design
  or declare the overall task verified.
- Run no more than three subagents concurrently, including nested delegation.
  This limit excludes the lead agent. Coordinate capacity across the whole team.
- Give each subagent a self-contained brief with scope, baseline, inputs,
  expected output, verification expectations, restrictions, and clear file
  ownership for authorized edits. All agents inherit the user's task boundaries.
  Wait for results and review them before incorporation.
- Choose a supported reasoning level deliberately: low for straightforward
  bounded work, medium for linked analysis, and high or above when complexity
  warrants it. Set model and reasoning level explicitly when tools permit.
- Name every subagent with its actual model, reasoning level, and role, in that
  order. Examples: `gpt_6_luna_low_fixture_check`,
  `gpt_6_1_sol_high_mesh_review`, and
  `gpt_6_astra_high_architecture_review`. Use effective settings, not a model
  inferred from the role; report unavailable requested settings rather than
  silently substituting them.

## Locate the baseline

- [docs/SETUP.md](docs/SETUP.md) records workspace provenance, setup limitations,
  commands, and the handoff location. Read it when setting up or resuming code work.
- Source repository: https://github.com/tekenterprises/snowflakes. Check its current
  head before implementation; never overwrite newer work with the review snapshot.
- In a complete checkout, `dist/` is maintained application source, not disposable
  build output. The build validates static assets; there is no bundler.
- `dist/app.js` owns UI orchestration and preview; `image-crystal.js` orchestrates
  crystal fitting; `shared-mesh.js` and `silhouette-mesh.js` build cells;
  `image-evidence.js` and `boundary-fit.js` interpret material boundaries;
  `structural-voids.js` classifies holes; `cut-output.js` applies cut operations.
- `tests/` contains Node regression scripts. Vendored geometry libraries live in
  `dist/vendor/`. Read only the modules and supporting documentation the task needs.

## Geometry contracts

- The photograph is the evidence. Preserve supported tips, notches, and voids;
  fit through noisy boundaries without systematically enlarging the shape.
- Crystal cuts are faceted artistic interpretations. Let supported structure
  determine complexity: simple flakes keep simple outlines; delicate branching
  flakes can justify detailed facets. Do not reproduce contour wiggles or inflate
  cell counts to chase numerical precision. Keep cell counts near the baseline.
- Build a universal toolkit for arbitrary uploaded flakes. Catalogue examples
  are regression fixtures, never runtime identities or hand-tuned exceptions.
  Patch selection must derive from geometry and image evidence on every input.
- Required target: crystal cells share vertices/edges, cover the interpreted
  material without interior overlap, and define the base crystal cut by their
  union perimeter. Improve cell generation with the accurate boundary evidence;
  do not hide disagreement with preview clipping or substitute an independent cut.
  This is a repair requirement, not a claim that the v33 baseline satisfies it.
- Preserve connected branches, shared radial/bilateral correspondence, intended
  3–6-sided cells, and the image-fitted or explicitly inferred central hexagon.
  At full symmetry, geometry must be exactly rotationally and bilaterally symmetric.
  Do not silently abandon correspondence to improve one local fit.
- Distinguish the base crystal geometry from later manufacturing adjustments:
  offset, rounding, gap closing, and hanger. Export closed final cut boundaries,
  not preview guides. Add the hanger last; neck length ends at the nearest hole
  edge, not its outer rim.
- Preserve structural-hole semantics: Fill retains supported structural cavities;
  faithful mode does not manufacture an absent local hole. Symmetry may repeat
  supported evidence. A classification count is not the final exported hole count.
- Prefer matching facets around holes. Small local cavity-facet differences are
  allowed when needed for clean, compact geometry; full symmetry must eliminate
  those differences by using one repeated subdivision. Keep variation minimal.
- Keep Vector, Branches, Image, and Crystal geo visibility independent from the
  choice of cut representation. At least one preview layer must remain visible.
- Keep coordinate conventions explicit: source-image transforms, 768px artboard,
  lower-resolution analysis grids, pixel centers/edges, radians/degrees, and mm.

## Verification and evidence

- For application changes, run the configured static build and default test suite
  from a complete checkout, plus focused regressions for the changed behavior.
  Use `package.json` as the command authority. Documentation-only edits need
  accuracy, link, whitespace, and consistency checks, not geometry reruns.
- Geometry tests must compare the actual cell union with the actual base cut,
  including holes, and check overlap, missing/excess material, finite coordinates,
  side counts, connectivity, and relevant symmetry settings. Nominal mesh tests
  alone do not establish final-cut correctness.
- Measure both added and omitted image material and signed area bias. Preserve
  meaningful thresholds; do not weaken checks or tune per-reference coordinates
  merely to obtain passing results.
- Use real reference flakes for visible geometry explanations and before/after
  comparisons. Include a whole-flake view, a useful zoom, clear colors, exact
  settings, and input/code provenance. Synthetic cases supplement these examples.
- Reference 20 exercises missed protrusions; 3/9 exercise simple plates; 18/19
  exercise open structures and holes. Expand coverage based on algorithm impact;
  a shared fitter change warrants checking all twenty references.
- Keep automated tests, diagnostic renders, actual browser interactions, and user
  acceptance distinct. Fixture rasterization can differ from browser canvas.
  Report the checks run, failures/skips, and limitations accurately.
- Preserve source fixtures. Keep generated diagnostics separate from deployable
  assets. Never present a partial review snapshot as a complete build or release.

## Git, releases, and documentation

- Inspect status and diffs; preserve other work. Do not initialize an unrelated
  application history around a partial source download. Recover the existing
  repository history when establishing the development checkout.
- Keep local edits, commits, GitHub publication, and live deployment distinct.
  Respect the user's authorized release stage; do not infer deployment permission
  from a review, plan, or request for comparisons. Honor authorization already given.
- For Cloudflare deployment, read `docs/DEPLOYMENT.md`. The existing Worker
  is `snow-wizard`; the saved project credential is the Windows User environment
  variable `SNOW_WIZARD_CLOUDFLARE_API_TOKEN`. Check project setup and relevant
  project chats before asking the user to recreate credentials. The generic
  inherited Cloudflare token is a different credential.
- Before a Sites release, follow the current Sites skill, verify the existing
  project identity, and preserve owner-private access. Never create a duplicate
  Site or alter unrelated Cloudflare resources. Confirm deployment success before
  calling a version live. Keep credentials out of files, logs, and source control.
- Update the owning documentation when a durable behavior or workflow changes.
  Keep temporary status, experiments, and measurements out of this file; update
  setup notes when their recorded limitations are resolved.
