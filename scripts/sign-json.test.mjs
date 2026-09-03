import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createPrivateKey, createPublicKey, randomBytes, verify } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, 'sign-json.mjs')

test('sign-json writes a matching detached hex signature', () => {
  const seed = randomBytes(32)
  const privateKey = createPrivateKey({
    key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]),
    format: 'der',
    type: 'pkcs8',
  })
  const publicHex = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex')
  const dir = mkdtempSync(join(tmpdir(), 'suutoken-sign-json-'))
  const json = join(dir, 'policy.json')
  const body = '{"schemaVersion":1}\n'
  writeFileSync(json, body)
  const result = spawnSync(process.execPath, [script, json], {
    env: {
      ...process.env,
      SUUTOKEN_RUNTIME_SIGNING_KEY: seed.toString('hex'),
      SUUTOKEN_RUNTIME_PUBLIC_KEY_HEX: publicHex,
    },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  const signature = Buffer.from(readFileSync(`${json}.sig`, 'utf8').trim(), 'hex')
  assert.equal(
    verify(null, Buffer.from(body), privateKey, signature),
    true,
  )
})
