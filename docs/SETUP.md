# Development setup

The repository is `tekenterprises/snowflakes`. This checkout was cloned from its
existing history at `d6612786ae7193e41ae090d17dc642d16411334e` on 2026-11-15.
Inspect current Git status and remote state before integrating newer work.

`dist/` is maintained static application source. No bundler is used. Node >=20
is declared; Node24.22.1 was available during setup. `npm` was absent from PATH,
so the exact commands in package.json were invoked with Node directly. No new
runtime dependency is needed; geometry libraries are vendored.

```powershell
npm run build
npm test
```

The build validates reference images, scripts, and links. The default suite uses
disposable synthetic data and VM DOM doubles. Read package.json for its current
commands; do not confuse those doubles with actual browser interaction.

Optional photographic checks use handoff fixtures. In the Snow Wizard workspace,
they are stored one directory above the checkout under `fixtures/`. Elsewhere,
set `SNOWFLAKE_FIXTURES` explicitly to that directory. The handoff ZIP and partial
review snapshot are historical material outside this checkout.

```powershell
node tests/crystal-material.cjs --refs=20 --symmetric
node tests/run-with-fixtures.cjs tests/cut-output.cjs --refs=3,5
```

Windows Git cloning succeeded with the Windows certificate store:
`git -c http.sslBackend=schannel clone https://github.com/tekenterprises/snowflakes.git app`.
Keep TLS verification enabled. Credentials, installed dependencies, fixture
binaries, and generated diagnostic renders do not belong in commits.

Local work, commits, GitHub publication, and Sites deployment are distinct steps.
The existing Site from the handoff is
`appgprj_6af233a61f148191a4c8bd1c77fdf31a`, owner-private. Verify it through current
Sites tools when deployment is authorized. Do not create another Site or change
unrelated Cloudflare resources. This development setup does not change live state.
