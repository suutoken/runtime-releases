import { readFile, writeFile } from 'node:fs/promises'

const channel = process.argv[2]
if (!['stable', 'preview'].includes(channel)) throw new Error('Invalid channel')
const manifest = JSON.parse(await readFile(`channels/codex-acp/${channel}/windows-x86_64.json`, 'utf8'))
if (manifest.version !== '1.10.0' || !manifest.artifactUrl.includes('/codex-acp-v1.10.0-c2/')) {
  throw new Error('Expected published Codex ACP 1.10.0 config 2')
}
for (const kind of ['policy', 'plugins']) {
  const path = `${kind}/${channel}.json`
  const document = JSON.parse(await readFile(path, 'utf8'))
  const entries = kind === 'policy' ? document.components : document.plugins
  const next = kind === 'plugins' ? { version: '1.10.0', configVersion: 2 } : {
    manifestOrigin: 'https://raw.githubusercontent.com',
    manifestPath: '/suutoken/runtime-releases/main/channels/codex-acp/{channel}/{platform}-{arch}.json',
    artifactOrigin: 'https://github.com',
    artifactPrefix: '/suutoken/runtime-releases/releases/download/codex-acp-',
  }
  if (JSON.stringify(entries['codex-acp']) === JSON.stringify(next)) continue
  entries['codex-acp'] = next
  document.version++
  await writeFile(path, JSON.stringify(document, null, 2) + '\n')
}
