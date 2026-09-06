import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolveArtifactUrl, validatePluginCatalog } from './validate-plugins.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const catalog = JSON.parse(
  await readFile(join(here, '..', 'plugins', 'stable.json'), 'utf8'),
)

test('live signed catalog still has three plugins until the operator re-signs', () => {
  assert.deepEqual(Object.keys(catalog.plugins).sort(), ['codex', 'grok', 'opencodex'])
  assert.throws(() => validatePluginCatalog(catalog), /exactly/)
})

test('four-plugin catalog including codex-acp is valid', () => {
  const next = structuredClone(catalog)
  next.plugins['codex-acp'] = { version: '1.10.0', configVersion: 1 }
  validatePluginCatalog(next)
  assert.equal(
    resolveArtifactUrl(next, 'codex', 'linux', 'x86_64'),
    'https://github.com/suutoken/runtime-releases/releases/download/codex-v0.153.2-c1/codex-0.153.2-linux-x86_64.zip',
  )
  assert.equal(
    resolveArtifactUrl(next, 'grok', 'windows', 'x86_64'),
    'https://github.com/suutoken/runtime-releases/releases/download/grok-v1.0.13-c1/grok-1.0.13-windows-x86_64.zip',
  )
  assert.equal(
    resolveArtifactUrl(next, 'opencodex', 'macos', 'aarch64'),
    'https://github.com/suutoken/runtime-releases/releases/download/opencodex-v2.39.0-c2/opencodex-2.39.0-macos-aarch64.zip',
  )
  assert.equal(
    resolveArtifactUrl(next, 'codex-acp', 'linux', 'x86_64'),
    'https://github.com/suutoken/runtime-releases/releases/download/codex-acp-v1.10.0-c1/codex-acp-1.10.0-linux-x86_64.zip',
  )
})

test('catalog rejects start commands and unknown plugin fields', () => {
  const invalid = structuredClone(catalog)
  invalid.plugins['codex-acp'] = { version: '1.10.0', configVersion: 1 }
  invalid.plugins.codex.start = 'codex app-server'
  assert.throws(
    () => validatePluginCatalog(invalid),
    /unknown field start/,
  )
})

test('catalog rejects a missing plugin', () => {
  const invalid = structuredClone(catalog)
  delete invalid.plugins.grok
  assert.throws(() => validatePluginCatalog(invalid), /exactly/)
})
