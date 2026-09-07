import { readFile, stat, writeFile } from 'node:fs/promises'

const [version, artifact, signatureFile, output] = process.argv.slice(2)
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('version must be exact semver')
if (!artifact || !signatureFile || !output) {
  throw new Error('usage: create-desktop-latest <version> <artifact> <signature> <output>')
}

const signature = (await readFile(signatureFile, 'utf8')).trim()
if (!signature) throw new Error('updater signature is empty')
const size = (await stat(artifact)).size
if (size <= 0) throw new Error('updater artifact is empty')

const document = {
  version,
  notes: 'Windows agent runtime startup and concurrent Codex dependency installation fixes.',
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url: `https://releases.suutoken.com/desktop/artifacts/${version}/SuuToken-windows-x86_64-setup.exe`,
      size,
    },
  },
}
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`)
