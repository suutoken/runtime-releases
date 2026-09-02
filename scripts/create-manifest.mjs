import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const [artifactArg, configVersionArg, releaseTag, outputArg] = process.argv.slice(2)
const seedHex = process.env.SUUTOKEN_RUNTIME_SIGNING_KEY?.trim()
const expectedPublicKey = process.env.SUUTOKEN_RUNTIME_PUBLIC_KEY_HEX?.trim().toLowerCase()
if (!artifactArg || !configVersionArg || !releaseTag || !outputArg || !seedHex || !expectedPublicKey) {
  throw new Error('artifact, config version, release tag, output, signing key and public key are required')
}
if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) throw new Error('signing key must be a 32-byte hex seed')

const artifact = resolve(artifactArg)
const metadata = JSON.parse(await readFile(`${artifact}.metadata.json`, 'utf8'))
const bytes = await readFile(artifact)
const configVersion = Number(configVersionArg)
if (!Number.isSafeInteger(configVersion) || configVersion < 1) throw new Error('invalid config version')

const manifest = {
  schemaVersion: 1,
  componentId: 'opencodex',
  version: metadata.version,
  minSuuTokenVersion: '0.1.0',
  platform: metadata.platform,
  arch: metadata.arch,
  artifactUrl: `https://github.com/suutoken/runtime-releases/releases/download/${releaseTag}/${basename(artifact)}`,
  compressedSize: metadata.compressedSize,
  uncompressedSize: metadata.uncompressedSize,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  configuration: {
    version: configVersion,
    managed: {
      hostname: '127.0.0.1',
      port: 10100,
      clientIntegrations: { codex: false, grok: false, 'claude-desktop': false },
      codexAutoStart: false,
      codexShimAutoRestore: false,
      oauthOpenBrowser: false,
      claudeCode: { enabled: false },
    },
    defaults: {},
  },
}

const body = `${JSON.stringify(manifest, null, 2)}\n`
const privateKey = createPrivateKey({
  key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(seedHex, 'hex')]),
  format: 'der',
  type: 'pkcs8',
})
const publicDer = createPublicKey(privateKey).export({ format: 'der', type: 'spki' })
const actualPublicKey = publicDer.subarray(-32).toString('hex')
if (actualPublicKey !== expectedPublicKey) {
  throw new Error(`signing key does not match the expected runtime public key (${actualPublicKey})`)
}

await writeFile(outputArg, body)
await writeFile(`${outputArg}.sig`, `${sign(null, Buffer.from(body), privateKey).toString('hex')}\n`)

