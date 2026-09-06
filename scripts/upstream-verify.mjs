import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const lockPath = join(dirname(fileURLToPath(import.meta.url)), 'upstream-lock.json')

export function loadUpstreamLock() {
  return JSON.parse(readFileSync(lockPath, 'utf8'))
}

export function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

export function verifySha256(buffer, expectedHex) {
  const actual = sha256Hex(buffer)
  const expected = String(expectedHex).trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(expected) || actual !== expected) {
    throw new Error(`upstream sha256 mismatch: expected ${expected}, got ${actual}`)
  }
}

export function verifyNpmIntegrity(buffer, integrity) {
  const match = String(integrity).match(/^sha512-([A-Za-z0-9+/=]+)$/)
  if (!match) {
    throw new Error(`unsupported npm integrity: ${integrity}`)
  }
  const actual = createHash('sha512').update(buffer).digest('base64')
  if (actual !== match[1]) {
    throw new Error('upstream npm integrity mismatch')
  }
}

export function verifyNpmShasum(buffer, shasum) {
  const expected = String(shasum).trim().toLowerCase()
  const actual = createHash('sha1').update(buffer).digest('hex')
  if (!/^[0-9a-f]{40}$/.test(expected) || actual !== expected) {
    throw new Error(`upstream npm shasum mismatch: expected ${expected}, got ${actual}`)
  }
}

export function lookupCodexLock(version, platform, arch) {
  const entry = loadUpstreamLock().codex?.[version]?.[`${platform}-${arch}`]
  if (!entry?.sha256 || !entry?.url || !entry?.asset) {
    throw new Error(`no researched Codex digest for ${version} ${platform}-${arch}`)
  }
  return entry
}

export function lookupCodexAcpLock(version) {
  const entry = loadUpstreamLock()['codex-acp']?.[version]
  if (!entry?.integrity || !entry?.tarball || !entry?.npm || !entry?.sha256) {
    throw new Error(`no researched Codex ACP digest for ${version}`)
  }
  return entry
}

export function verifyCodexAcpDownload(buffer, version) {
  const lock = lookupCodexAcpLock(version)
  verifySha256(buffer, lock.sha256)
  verifyNpmIntegrity(buffer, lock.integrity)
  if (lock.shasum) {
    verifyNpmShasum(buffer, lock.shasum)
  }
  return lock
}

export function lookupGrokLock(version, platform, arch) {
  const entry = loadUpstreamLock().grok?.[version]?.[`${platform}-${arch}`]
  if (!entry?.integrity || !entry?.tarball || !entry?.npm) {
    throw new Error(`no researched Grok digest for ${version} ${platform}-${arch}`)
  }
  return entry
}

export function verifyCodexDownload(buffer, version, platform, arch) {
  const lock = lookupCodexLock(version, platform, arch)
  verifySha256(buffer, lock.sha256)
  return lock
}

export function verifyGrokDownload(buffer, version, platform, arch) {
  const lock = lookupGrokLock(version, platform, arch)
  verifyNpmIntegrity(buffer, lock.integrity)
  if (lock.shasum) {
    verifyNpmShasum(buffer, lock.shasum)
  }
  return lock
}
