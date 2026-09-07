import { readFile, writeFile } from 'node:fs/promises'

const channel = process.argv[2]
if (!['stable', 'preview'].includes(channel)) throw new Error('Invalid channel')
const manifest = JSON.parse(await readFile(`channels/codex/${channel}/windows-x86_64.json`, 'utf8'))
if (manifest.version !== '0.153.2' || !manifest.artifactUrl.includes('/codex-v0.153.2-c2/')) {
  throw new Error('Expected published Codex 0.153.2 config 2')
}
for (const kind of ['policy', 'plugins']) {
  const path = `${kind}/${channel}.json`
  const document = JSON.parse(await readFile(path, 'utf8'))
  const entries = kind === 'policy' ? document.components : document.plugins
  const next = kind === 'plugins' ? { version: '0.153.2', configVersion: 2 } : {
    manifestOrigin: 'https://raw.githubusercontent.com',
    manifestPath: '/suutoken/runtime-releases/main/channels/codex/{channel}/{platform}-{arch}.json',
    artifactOrigin: 'https://github.com',
    artifactPrefix: '/suutoken/runtime-releases/releases/download/codex-',
  }
  if (JSON.stringify(entries.codex) === JSON.stringify(next)) continue
  entries.codex = next
  document.version++
  await writeFile(path, JSON.stringify(document, null, 2) + '\n')
}
