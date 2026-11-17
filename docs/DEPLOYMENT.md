# Cloudflare deployment

The existing target is the `snow-wizard` Worker, configured in `wrangler.jsonc`,
in account `d6efd5ef2511200c3d09dffdfac53e04`. The project chat
“Review Cloudflare access needs” established and verified this target.
It serves the static browser webapp from `dist/`; uploaded images are processed
locally by the browser. No database, API Worker, DNS change, or account-wide
resource change is needed.

Before publishing, run the static build and configured tests and inspect Git
status. Push the verified source to `tekenterprises/snowflakes` without rewriting
history. Verify the exact remote commit. Deployment is a separate step.

With a valid Cloudflare login/token and the intended account selected:

```powershell
wrangler deploy --config wrangler.jsonc
```

Set `CLOUDFLARE_ACCOUNT_ID` to the verified account when multiple accounts are
available. Do not guess an account from a different project's credentials. Keep
tokens out of source, logs, and command arguments. Do not deploy over an unrelated
Worker; verify the existing target and preserve its routes and access settings.

On this Windows host, the project-scoped token is saved in the **User** environment
as `SNOW_WIZARD_CLOUDFLARE_API_TOKEN`. Read it with
`[Environment]::GetEnvironmentVariable('SNOW_WIZARD_CLOUDFLARE_API_TOKEN', 'User')`
and assign it to the deployment child process's `CLOUDFLARE_API_TOKEN` without
printing or saving the value. The generic inherited `CLOUDFLARE_API_TOKEN` is a
different credential; do not mistake its expiration for failure of the project
token. This credential is scoped to the existing Worker, so account-wide listing
endpoints can be denied even when deployment access is valid.

Wrangler4.148.0 was available locally during setup. On this Windows environment,
`NODE_USE_SYSTEM_CA=1` and a direct process-local connection resolved the TLS/proxy
issue without disabling certificate verification. `WRANGLER_LOG_PATH` can point
to a workspace-local directory. These environment workarounds are local setup,
not application runtime settings.

After deployment, verify the returned Worker version/deployment ID and fetch the
served HTML plus changed assets. Match their bytes/version to the committed
source before reporting the webapp live. Record HTTP/static verification separately from any authorized browser
interaction QA.

The old owner-private Sites app is a separate deployment and is not updated by
this command. No permission to modify unrelated Cloudflare resources is implied.

Official configuration reference:
https://developers.cloudflare.com/workers/static-assets/binding/

## Verified v34 deployment — 2026-11-15

- Live app: https://snow-wizard.evan-d6e.workers.dev
- Deployed source/config commit: `3be8a85b978d9716e86902aae1a493c8e06210aa`.
- Worker version: `0009eba2-722e-4aa0-b44a-e01d7c10e9f2`.
- Deployment: `58741820-051a-443c-ae6f-087cb7a65a20`, 100% traffic.
- All53 public static files were fetched over HTTPS and matched local release
  bytes. The workers.dev endpoint remains enabled and preview URLs disabled,
  matching the pre-deployment settings. No browser automation was used.

The deployment initially appeared blocked only because the unrelated generic
token was checked. The project token established in “Review Cloudflare access
needs” was present and valid; no replacement token was required.

## Verified v35 deployment — 2026-11-15

- Live app: https://snow-wizard.evan-d6e.workers.dev
- Deployed source commit: `6fa1adba421ddd8b0a996b153b11c3c280fe1689`.
- Worker version: `0fdeb893-a926-45ee-8c00-975bf9721371`.
- Deployment: `67a1d85f-66e9-4632-b825-2cab4869060a`, 100% traffic.
- All 56 public static files matched local release bytes over HTTPS, including
  the new background worker, client, and pipeline scripts. GitHub's main branch
  was verified at the source commit before deployment.
- The workers.dev endpoint remains enabled and preview URLs disabled. Browser
  automation was not used; build, regression, deployment API, and HTTP checks are
  recorded separately in [v35 validation](VALIDATION-v35.md).


## Verified v36 deployment — 2026-11-17

- Live app: https://snow-wizard.evan-d6e.workers.dev/
- Deployed application source: `600409c27ce681b95354dd3db8ddbb2e1a761fed`.
- Worker version: `0e295409-fc50-43e0-b006-2fef611d114a`.
- Deployment: `2f9e2534-7db0-4a44-86c4-363212a18a31`, 100% traffic.
- All 61 public static files matched raw committed release bytes over HTTPS.
  Verification completed at 2026-11-17T17:01:41Z. An initial license-file response
  was stale during propagation; the complete final comparison passed.
- The workers.dev endpoint remains enabled and preview URLs disabled, confirmed
  through the scoped Worker API. No unrelated resources were changed.
- The staged release candidate passed its static build and all 22 default suites.
  All twenty references were checked through actual cell unions/cuts and symmetry
  poses; see [v36 validation](VALIDATION-v36.md) for provenance and limitations.
- Authorized browser checks confirmed v36, live reference-18 crystal reconstruction,
  enabled export, and no captured browser warnings/errors. Local reference-17 SVG
  export was parsed separately. The real live screenshot is a development artifact,
  not a deployed application asset.

For future releases, export the candidate directly from Git blobs (for example,
`git show COMMIT:dist/PATH`) rather than a dirty working directory. Windows checkout EOL filters
can convert files even in a staged-tree export; compare candidate assets with
`git show COMMIT:dist/PATH` before upload. Build/test the isolated candidate and
verify served bytes against that exact release. Documentation-only release records
may follow in a separate commit without redeploying unchanged static assets.


## Verified v37 deployment — 2026-11-17

- Live app: https://snow-wizard.evan-d6e.workers.dev/
- Deployed application source: `cd4d402a1baa9d39de53de143ad52e4003b15eb9`.
- Worker version: `b7dc0e7b-46e0-441b-ba85-5a0327ae297c`.
- Deployment: `bc450e50-a147-4dea-99e9-21acde1eefbb`, 100% traffic.
- All 63 public static files matched the exact committed release bytes over HTTPS
  at 2026-11-17T20:02:45Z. The root HTML also reports v37.
- The workers.dev endpoint remains enabled and preview URLs disabled, verified
  before and after deployment through the scoped Worker API. No unrelated
  resources were changed.
- The isolated release passed the static build, all 30 default suites, all twenty
  references at symmetry 0/50/100, and all 240 parallel/serial side comparisons.
  See [v37 validation and timings](validation-v37.md). The 2–3s cold-load target
  remains unmet; the dense browser-input crystal replay still takes 27.58s.
- Browser interaction QA and timing observations were performed locally before
  deployment. Live verification used HTTPS asset comparisons and deployment API
  checks; it did not establish new browser timing measurements.
- This release used raw `git show` blob bytes. On this host, `git archive` also
  applied checkout newline conversion; its output was normalized-equivalent but
  did not match the committed bytes. The final raw-blob candidate was verified
  independently and passed its build/default suite before upload.
