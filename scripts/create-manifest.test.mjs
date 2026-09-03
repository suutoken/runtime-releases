import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { createPrivateKey, createPublicKey, randomBytes } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, 'create-manifest.mjs')

function throwawayKeys() {
  const seed = randomBytes(32)
  const privateKey = createPrivateKey({
    key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]),
    format: 'der',
    type: 'pkcs8',
  })
  const publicDer = createPublicKey(privateKey).export({ format: 'der', type: 'spki' })
  return {
    seedHex: seed.toString('hex'),
    publicHex: publicDer.subarray(-32).toString('hex'),
  }
}

function writeArtifact(dir, { file, metadata }) {
  const zip = join(dir, file)
  writeFileSync(zip, Buffer.from('PK\x05\x06' + '\0'.repeat(18)))
  writeFileSync(`${zip}.metadata.json`, JSON.stringify(metadata, null, 2))
  return zip
}

function runManifest(env, args) {
  return spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
}

test('create-manifest rejects metadata that does not match the file name or workflow version', () => {
  const keys = throwawayKeys()
  const dir = mkdtempSync(join(tmpdir(), 'suutoken-manifest-'))
  mkdirSync(dir, { recursive: true })
  const env = {
    SUUTOKEN_RUNTIME_SIGNING_KEY: keys.seedHex,
    SUUTOKEN_RUNTIME_PUBLIC_KEY_HEX: keys.publicHex,
    OPENCODEX_VERSION: '2.39.0',
  }
  const zip = writeArtifact(dir, {
    file: 'opencodex-2.39.0-linux-x86_64.zip',
    metadata: {
      componentId: 'opencodex',
      version: '9.9.9',
      platform: 'linux',
      arch: 'x86_64',
      file: 'opencodex-2.39.0-linux-x86_64.zip',
      compressedSize: 22,
      uncompressedSize: 0,
    },
  })
  const result = runManifest(env, [zip, '1', 'opencodex-v2.39.0-c1', join(dir, 'linux-x86_64.json')])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /metadata does not match/)
})

test('create-manifest rejects injected version and config inputs', () => {
  const keys = throwawayKeys()
  const dir = mkdtempSync(join(tmpdir(), 'suutoken-manifest-'))
  const zip = writeArtifact(dir, {
    file: 'opencodex-2.39.0-linux-x86_64.zip',
    metadata: {
      componentId: 'opencodex',
      version: '2.39.0',
      platform: 'linux',
      arch: 'x86_64',
      file: 'opencodex-2.39.0-linux-x86_64.zip',
      compressedSize: 22,
      uncompressedSize: 0,
    },
  })
  const baseEnv = {
    SUUTOKEN_RUNTIME_SIGNING_KEY: keys.seedHex,
    SUUTOKEN_RUNTIME_PUBLIC_KEY_HEX: keys.publicHex,
    OPENCODEX_VERSION: '2.39.0',
  }
  const bad = runManifest(
    { ...baseEnv, OPENCODEX_VERSION: "2.39.0'; id" },
    [zip, '1', 'opencodex-v2.39.0-c1', join(dir, 'out.json')],
  )
  assert.notEqual(bad.status, 0)
  const badConfig = runManifest(baseEnv, [zip, '1; rm -rf /', 'opencodex-v2.39.0-c1', join(dir, 'out.json')])
  assert.notEqual(badConfig.status, 0)
  const badTag = runManifest(baseEnv, [zip, '1', 'opencodex-v2.39.0-c1$(id)', join(dir, 'out.json')])
  assert.notEqual(badTag.status, 0)
})

test('package-opencodex rejects non-semver before installing npm packages', () => {
  const pack = join(here, 'package-opencodex.mjs')
  const result = spawnSync(
    process.execPath,
    [pack, 'latest', 'linux', 'x86_64', 'dist/opencodex-latest-linux-x86_64.zip'],
    { encoding: 'utf8' },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /exact MAJOR.MINOR.PATCH/)
  const quoted = spawnSync(
    process.execPath,
    [pack, "2.39.0'; npm install evil", 'linux', 'x86_64', 'dist/opencodex-2.39.0-linux-x86_64.zip'],
    { encoding: 'utf8' },
  )
  assert.notEqual(quoted.status, 0)
})
