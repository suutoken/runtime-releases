# SuuToken Runtime Releases

Public, signed runtime artifacts consumed by SuuToken Desktop. This repository contains no
signing private keys and no SuuToken application source.

## OpenCodex release

The workflow is split into `package → sign → publish`:

1. **package** (one job per platform): `npm ci`, upstream OpenCodex install, launcher build, ZIP
   plus `.metadata.json`. These jobs have `contents: read` and never receive
   `SUUTOKEN_RUNTIME_SIGNING_KEY`.
2. **sign** (ubuntu only): downloads unsigned artifacts and runs `scripts/create-manifest.mjs`
   (Node standard library only — no `npm ci`, no upstream package code). The signing secret is
   injected only in this job's sign step.
3. **publish**: creates the immutable GitHub Release and updates channel manifests. It does not
   receive the signing secret.

External Actions are pinned to full commit SHAs. Signed channel manifests live under
`channels/opencodex/<channel>/`.

Required repository secret:

- `SUUTOKEN_RUNTIME_SIGNING_KEY`: 32-byte Ed25519 seed as 64 hexadecimal characters. Its public
  key must match the value compiled into SuuToken Desktop and the workflow. Do not use this key
  for ordinary PR tests; local dry-runs must use a throwaway key pair.

Run **Release OpenCodex runtime** manually. `version` must be an exact `MAJOR.MINOR.PATCH` semver
and `config_version` a positive integer; both are passed through step `env` (never interpolated into
shell source) and re-validated by the package/sign scripts. `config_version` must always increase,
including for configuration-only releases. The publish job updates channel manifests only after
every platform package, isolated signing, and the immutable GitHub Release have succeeded.

Clients read manifests from:

```text
https://raw.githubusercontent.com/suutoken/runtime-releases/main/channels/opencodex/stable/<platform>-<arch>.json
```

## Comments

### 2026-09-02 - Grok

`opencodex-release.yml` is now `package → sign → publish`. Package jobs never see
`SUUTOKEN_RUNTIME_SIGNING_KEY`. Sign runs `scripts/create-manifest.mjs` with Node stdlib only.

### 2026-09-03 - Grok

`assertConfigVersion` now requires `Number.isSafeInteger` and `1..=4294967295` (`u32::MAX`).
`4294967296` and oversized digit strings are rejected.

Dispatch inputs are copied into `OPENCODEX_*` env vars and validated as an exact
`MAJOR.MINOR.PATCH` plus a positive integer config version before `npm ci`, signing, or
`gh release`. `node --test scripts/release-args.test.mjs scripts/create-manifest.test.mjs`
rejected quote/command-substitution/`latest` inputs (7 passed). Production signing key was
not used. Formal release was not triggered.

Local dry-run (Linux, no GitHub `workflow_dispatch`, no production key):

```text
node scripts/create-manifest.mjs /tmp/suutoken-sign-dry/tiny.zip 1 opencodex-v2.39.0-c1 ...
```

Used a throwaway Ed25519 seed. Public key `db68435d…0d8f56` ≠ production
`2ec5838862c48bdc3cbaa6ac74f208294a6a1920a003a56d0bbede162992f800`. Manifest + `.sig` written.
Throwaway seed deleted afterwards. Formal OpenCodex release was not triggered.
