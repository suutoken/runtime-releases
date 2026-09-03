import { createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [inputArg] = process.argv.slice(2)
const seedHex = process.env.SUUTOKEN_RUNTIME_SIGNING_KEY?.trim()
const expectedPublicKey = process.env.SUUTOKEN_RUNTIME_PUBLIC_KEY_HEX?.trim().toLowerCase()
if (!inputArg || !seedHex || !expectedPublicKey) {
  throw new Error('json path, signing key and public key are required')
}
if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) throw new Error('signing key must be a 32-byte hex seed')

const input = resolve(inputArg)
const body = await readFile(input)
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

await writeFile(`${input}.sig`, `${sign(null, body, privateKey).toString('hex')}\n`)
