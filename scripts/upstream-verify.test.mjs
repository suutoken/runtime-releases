import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import {
  lookupCodexAcpLock,
  lookupCodexLock,
  lookupGrokLock,
  sha256Hex,
  verifyCodexAcpDownload,
  verifyCodexDownload,
  verifyGrokDownload,
  verifyNpmIntegrity,
  verifySha256,
} from './upstream-verify.mjs'

test('committed lock retains researched Codex, Grok, and Codex ACP digests', () => {
  const codex = lookupCodexLock('0.153.2', 'linux', 'x86_64')
  assert.equal(codex.asset, 'codex-x86_64-unknown-linux-musl.tar.gz')
  assert.equal(
    codex.sha256,
    'e8cd1160071f725d2a10cab81073dd6818fc8b096372125d27ef6e66fdf0979e',
  )
  const acp = lookupCodexAcpLock('1.10.0')
  assert.equal(acp.npm, '@agentclientprotocol/codex-acp')
  assert.equal(
    acp.sha256,
    '9dffb525b728d0579a8b19d48322281ecad7eea7ba1640fa2f8de1199346352c',
  )
  const grok = lookupGrokLock('1.0.13', 'linux', 'x86_64')
  assert.equal(grok.npm, '@xai-official/grok-linux-x64')
  assert.equal(
    grok.integrity,
    'sha512-t0TpPmsEZwwS0utHq07L1oPX7tMgufAazIziccGn8IdTpo8ihqZ7KjaI6wikROXExfjvwTh83m4B0PL2ErPeiw==',
  )
})

test('correct digest is accepted and one-byte corruption is rejected before extract', () => {
  const buffer = Buffer.from('tiny-upstream-archive')
  const digest = sha256Hex(buffer)
  let extracted = false
  const extract = () => {
    extracted = true
  }

  verifySha256(buffer, digest)
  extract()
  assert.equal(extracted, true)

  extracted = false
  const corrupt = Buffer.from(buffer)
  corrupt[0] ^= 0xff
  assert.throws(() => {
    verifySha256(corrupt, digest)
    extract()
  }, /upstream sha256 mismatch/)
  assert.equal(extracted, false)
})

test('npm integrity accepts the matching buffer and rejects a flipped byte', () => {
  const buffer = Buffer.from('tiny-npm-tarball')
  const integrity = `sha512-${createHash('sha512').update(buffer).digest('base64')}`
  let extracted = false
  verifyNpmIntegrity(buffer, integrity)
  extracted = true
  assert.equal(extracted, true)

  extracted = false
  const corrupt = Buffer.from(buffer)
  corrupt[3] ^= 0x01
  assert.throws(() => {
    verifyNpmIntegrity(corrupt, integrity)
    extracted = true
  }, /upstream npm integrity mismatch/)
  assert.equal(extracted, false)
})

test('unknown version or platform is refused before packaging', () => {
  assert.throws(
    () => lookupCodexLock('0.0.0', 'linux', 'x86_64'),
    /no researched Codex digest/,
  )
  assert.throws(
    () => lookupGrokLock('1.0.13', 'plan9', 'x86_64'),
    /no researched Grok digest/,
  )
  assert.throws(
    () => verifyCodexDownload(Buffer.from('x'), '9.9.9', 'linux', 'x86_64'),
    /no researched Codex digest/,
  )
  assert.throws(
    () => verifyGrokDownload(Buffer.from('x'), '9.9.9', 'linux', 'x86_64'),
    /no researched Grok digest/,
  )
  assert.throws(
    () => lookupCodexAcpLock('0.0.0'),
    /no researched Codex ACP digest/,
  )
  assert.throws(
    () => verifyCodexAcpDownload(Buffer.from('x'), '9.9.9'),
    /no researched Codex ACP digest/,
  )
})
