# Browser-local processing

The main thread draws the aligned source once per image transform. It retains
that raster and its PNG preview while threshold, cut, and visibility controls
change. Vector/image visibility repaints the existing result. Enabling a guide
requests its missing geometry without changing the cut representation.

`geometry-client.js` sends computation to the persistent classic Web Worker in
`geometry-worker.js`. There is one running job and at most one pending job;
new controls replace the pending job. Revision IDs prevent an obsolete result
from replacing the latest preview. Export waits for the current request and
checks its semantic key. Processing disables export until that result arrives.
This keeps solver work off the browser UI thread; it does not make an already
running job interruptible. A queued change waits for that job to finish.

Source pixels transfer as a copy on source changes, leaving the main-thread
image intact. Solver functions, masks, and topology stay in the worker. Only
paint/export data returns through structured clone. No photo is sent to a server.
If worker construction, startup, or messaging fails, the same pipeline runs
synchronously as a compatibility fallback; that fallback can still block the UI.

`geometry-pipeline.js` retains threshold masks, one measured branch graph, and
six recently used detail/symmetry fits. Source transforms and threshold/invert
changes invalidate the corresponding downstream stages. Manufacturing controls
reuse the fitted image geometry. CutOutput caches structural classification,
protected masks, fitted cavities, and actual cell geometry by input identity and
the settings that change them. Cache identities require immutable input pixels,
masks, and fitted objects; do not mutate those inputs in place.

The shared fitter uses sparse reversible trials and conservative spatial bounds
to avoid whole-mesh copying and irrelevant intersection work. Baseline and
evidence poses reuse an immutable scaffold but still run independently through
the original quality gate. Canonical edge subdivisions are cached by vertex-array
identity. Cavity carving prepares integer hole paths once and excludes only holes
whose integer bounds are strictly disjoint from a cell. Touching bounds still
receive the original exact clipping checks.

Source repair can reduce a scaffold substantially. Cheap cavity merges still aim
for 110% of that smaller mesh, but expensive patch retessellation runs only when
needed to meet 110% of the original scaffold. This avoids spending seconds to
remove a few facets after the repair has already reduced the original cell count.
It preserves the existing budget for inputs that do not need source repair.
The material, grid-validity, topology, and XOR checks remain in place whenever
retessellation is needed.

Run the default suite for pipeline invalidation, stale-result/coalescing behavior,
fallback errors, actual worker imports and synchronous/worker output parity.
The DOM doubles and Node worker-thread tests do not establish browser interaction
performance. `node tests/performance.cjs --refs=13,20` prints informational stage
timings against local photographic fixtures; timings have no pass/fail threshold.
