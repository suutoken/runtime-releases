# SuuToken Runtime Releases

Public, signed runtime artifacts consumed by SuuToken Desktop. This repository contains no
signing private keys and no SuuToken application source.

## OpenCodex release

The workflow packages the pinned npm release together with Node and its Bun dependency, removes
the upstream GUI, builds a small platform launcher, and publishes immutable ZIP artifacts. Signed
channel manifests live under `channels/opencodex/<channel>/`.

Required repository secret:

- `SUUTOKEN_RUNTIME_SIGNING_KEY`: 32-byte Ed25519 seed as 64 hexadecimal characters. Its public
  key must match the value compiled into SuuToken Desktop and the workflow.

Run **Release OpenCodex runtime** manually. `config_version` must always increase, including for
configuration-only releases. The publish job updates channel manifests only after every platform
package and the immutable GitHub Release have succeeded.

Clients read manifests from:

```text
https://raw.githubusercontent.com/suutoken/runtime-releases/main/channels/opencodex/stable/<platform>-<arch>.json
```
