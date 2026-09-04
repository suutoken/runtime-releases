import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  artifactName,
  assertArch,
  assertChannel,
  assertConfigVersion,
  assertExactSemver,
  assertPlatform,
  parseArtifactName,
} from './release-args.mjs'

const here = dirname(fileURLToPath(import.meta.url))

test('accepts an exact npm semver and positive config version', () => {
  assertExactSemver('2.39.0')
  assertExactSemver('2.39.1')
  assertExactSemver('2.39.9')
  assertExactSemver('0.1.0')
  assertExactSemver('1.0.1')
  assert.equal(assertConfigVersion('1'), 1)
  assert.equal(assertConfigVersion('12'), 12)
  assert.equal(assertConfigVersion('4294967295'), 4294967295)
  assert.equal(artifactName('2.39.0', 'linux', 'x86_64'), 'opencodex-2.39.0-linux-x86_64.zip')
  assert.equal(artifactName('2.39.1', 'linux', 'x86_64'), 'opencodex-2.39.1-linux-x86_64.zip')
  assert.deepEqual(parseArtifactName('opencodex-2.39.0-linux-x86_64.zip'), {
    component: 'opencodex',
    version: '2.39.0',
    platform: 'linux',
    arch: 'x86_64',
  })
  assert.deepEqual(parseArtifactName('opencodex-2.39.1-macos-aarch64.zip'), {
    component: 'opencodex',
    version: '2.39.1',
    platform: 'macos',
    arch: 'aarch64',
  })
  assert.equal(artifactName('0.153.2', 'linux', 'x86_64', 'codex'), 'codex-0.153.2-linux-x86_64.zip')
  assert.equal(artifactName('1.0.13', 'windows', 'x86_64', 'grok'), 'grok-1.0.13-windows-x86_64.zip')
  assert.deepEqual(parseArtifactName('codex-0.153.2-linux-x86_64.zip'), {
    component: 'codex',
    version: '0.153.2',
    platform: 'linux',
    arch: 'x86_64',
  })
})

test('rejects quotes, command substitution, ranges and non-semver versions', () => {
  const bad = [
    "2.39.0'; rm -rf /; echo '",
    '2.39.0$(reboot)',
    '2.39.0`id`',
    '2.39.0" && curl evil',
    '^2.39.0',
    '~2.39.0',
    '>=2.39.0',
    'latest',
    '2.39',
    '2.39.0-beta.1',
    'file:../evil',
    '2.39.0\n1.0.0',
    '',
  ]
  for (const version of bad) {
    assert.throws(() => assertExactSemver(version), /exact MAJOR.MINOR.PATCH/)
  }
})

test('rejects invalid config versions, platforms and arches', () => {
  for (const value of [
    '0',
    '-1',
    '1.2',
    '1; rm',
    '1$(id)',
    '',
    '01',
    '4294967296',
    '999999999999999999999999999999999999',
  ]) {
    assert.throws(() => assertConfigVersion(value))
  }
  assert.throws(() => assertPlatform('linux; id'))
  assert.throws(() => assertArch('x86_64`id`'))
  assert.throws(() => assertChannel('stable; git push'))
  assert.throws(() => parseArtifactName('opencodex-2.39.0-linux-x86_64.zip; rm -rf /'))
})

test('validate-release-inputs fails closed on injected workflow inputs', () => {
  const script = join(here, 'validate-release-inputs.mjs')
  const cases = [
    { OPENCODEX_VERSION: "2.39.0'; echo pwned", OPENCODEX_CONFIG_VERSION: '1' },
    { OPENCODEX_VERSION: '2.39.0$(id)', OPENCODEX_CONFIG_VERSION: '1' },
    { OPENCODEX_VERSION: 'latest', OPENCODEX_CONFIG_VERSION: '1' },
    { OPENCODEX_VERSION: '2.39.0', OPENCODEX_CONFIG_VERSION: '1; rm -rf /' },
    { OPENCODEX_VERSION: '2.39.0', OPENCODEX_CONFIG_VERSION: '0' },
    { OPENCODEX_VERSION: '2.39.0', OPENCODEX_CONFIG_VERSION: '4294967296' },
    {
      OPENCODEX_VERSION: '2.39.0',
      OPENCODEX_CONFIG_VERSION: '999999999999999999999999999999999999',
    },
  ]
  for (const env of cases) {
    const result = spawnSync(process.execPath, [script], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
    })
    assert.notEqual(result.status, 0, JSON.stringify(env))
  }
  const ok = spawnSync(process.execPath, [script], {
    env: {
      ...process.env,
      OPENCODEX_VERSION: '2.39.0',
      OPENCODEX_CONFIG_VERSION: '1',
      OPENCODEX_CHANNEL: 'stable',
    },
    encoding: 'utf8',
  })
  assert.equal(ok.status, 0, ok.stderr)
})
