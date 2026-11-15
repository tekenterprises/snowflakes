# Cloudflare deployment

The requested target is the `snow-wiz` Worker, configured in `wrangler.jsonc`.
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
