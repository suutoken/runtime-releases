import { readFile, writeFile } from 'node:fs/promises'

const channel = process.argv[2]
if (!['stable', 'preview'].includes(channel)) throw new Error('Invalid channel')
const manifest = JSON.parse(await readFile(`channels/codex-acp/${channel}/windows-x86_64.json`, 'utf8'))
if (manifest.version !== '1.10.0' || !manifest.artifactUrl.includes('/codex-acp-v1.10.0-c1/')) {
  throw new Error('Expected published Codex ACP 1.10.0 config 1')
}
for (const kind of ['policy', 'plugins']) {
  const path = `${kind}/${channel}.json`
  const document = JSON.parse(await readFile(path, 'utf8'))
  const entries = kind === 'policy' ? document.components : document.plugins
  if (entries['codex-acp']) continue
  entries['codex-acp'] = kind === 'plugins' ? { version: '1.10.0', configVersion: 1 } : {
    manifestOrigin: 'https://raw.githubusercontent.com',
    manifestPath: '/suutoken/runtime-releases/main/channels/codex-acp/{channel}/{platform}-{arch}.json',
    artifactOrigin: 'https://github.com',
    artifactPrefix: '/suutoken/runtime-releases/releases/download/codex-acp-',
  }
  document.version++
  await writeFile(path, JSON.stringify(document, null, 2) + '\n')
}
