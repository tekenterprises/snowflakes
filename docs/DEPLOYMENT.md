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
source before reporting the webapp live. Browser automation is not authorized
for this task; HTTP/static verification is distinct from browser interaction QA.

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
