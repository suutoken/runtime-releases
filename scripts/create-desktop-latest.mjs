import { readFile, stat, writeFile } from 'node:fs/promises'

const [version, artifact, signatureFile, output, target = 'windows-x86_64'] = process.argv.slice(2)
if (!['windows-x86_64', 'windows-x86_64-portable'].includes(target)) throw new Error('unsupported desktop target')
const filename = target.endsWith('-portable') ? 'SuuToken-portable-windows-x86_64.exe' : 'SuuToken-windows-x86_64-setup.exe'
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('version must be exact semver')
if (!artifact || !signatureFile || !output) {
  throw new Error('usage: create-desktop-latest <version> <artifact> <signature> <output>')
}

const signature = (await readFile(signatureFile, 'utf8')).trim()
if (!signature) throw new Error('updater signature is empty')
const size = (await stat(artifact)).size
if (size <= 0) throw new Error('updater artifact is empty')

const notes = (process.env.DESKTOP_RELEASE_NOTES || '').trim()
  || 'Portable stable launcher, retained versions and automatic interrupted-update recovery.'

const document = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    [target]: {
      signature,
      url: `https://releases.suutoken.com/desktop/artifacts/${version}/${filename}`,
      size,
    },
  },
}
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`)
