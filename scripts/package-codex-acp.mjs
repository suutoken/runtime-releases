import archiver from 'archiver'
import { createWriteStream } from 'node:fs'
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { artifactName, assertArch, assertExactSemver, assertPlatform } from './release-args.mjs'
import { verifyCodexAcpDownload } from './upstream-verify.mjs'
import { includeHiddenModels } from './codex-acp-patch.mjs'

const [version, platform, arch, outputArg] = process.argv.slice(2)
if (!version || !platform || !arch || !outputArg) {
  throw new Error('usage: package-codex-acp <version> <platform> <arch> <output.zip>')
}
assertExactSemver(version)
assertPlatform(platform)
assertArch(arch)

const output = resolve(outputArg)
const expectedName = artifactName(version, platform, arch, 'codex-acp')
if (basename(output) !== expectedName) {
  throw new Error(`output file must be named ${expectedName}`)
}

const tarballUrl = `https://registry.npmjs.org/@agentclientprotocol/codex-acp/-/codex-acp-${version}.tgz`
const work = await mkdtemp(join(tmpdir(), 'suutoken-codex-acp-'))
const root = join(work, 'package')
const app = join(root, 'app', 'node_modules', '@agentclientprotocol', 'codex-acp')
const runtime = join(root, 'runtime')

try {
  await mkdir(app, { recursive: true })
  await mkdir(runtime, { recursive: true })
  const tarball = join(work, 'codex-acp.tgz')
  const bytes = await download(tarballUrl)
  const lock = verifyCodexAcpDownload(bytes, version)
  if (lock.tarball !== tarballUrl || lock.npm !== '@agentclientprotocol/codex-acp') {
    throw new Error('Codex ACP lock does not match the requested tarball URL')
  }
  await writeFile(tarball, bytes)
  const extract = join(work, 'npm')
  await mkdir(extract, { recursive: true })
  run('tar', ['-xzf', tarball, '-C', extract])
  await cp(join(extract, 'package'), app, { recursive: true })
  const bundle = join(app, 'dist', 'index.js')
  await writeFile(bundle, includeHiddenModels(await readFile(bundle, 'utf8'), version))
  // The adapter is a bundled dist/index.js. Do not npm-install it: that would
  // pull a second @openai/codex CLI. CODEX_PATH is the managed Codex binary.
  await cp(process.execPath, join(runtime, platform === 'windows' ? 'node.exe' : 'node'))

  const launcherName = platform === 'windows' ? 'codex-acp.cmd' : 'codex-acp'
  await writeFile(join(root, launcherName), launcherScript(platform))
  if (platform !== 'windows') {
    await chmod(join(root, launcherName), 0o755)
    await chmod(join(runtime, 'node'), 0o755)
  }

  await materializeSymlinks(root)

  await mkdir(dirname(output), { recursive: true })
  const uncompressedSize = await directorySize(root)
  await zipDirectory(root, output)
  await writeFile(`${output}.metadata.json`, JSON.stringify({
    componentId: 'codex-acp',
    version,
    platform,
    arch,
    file: basename(output),
    compressedSize: (await stat(output)).size,
    uncompressedSize,
    upstreamNpm: lock.npm,
    upstreamTarball: lock.tarball,
    upstreamIntegrity: lock.integrity,
    upstreamShasum: lock.shasum,
    upstreamSha256: lock.sha256,
    patches: ['codex-acp-1.10.0-include-hidden-models-v1'],
  }, null, 2))
} finally {
  await rm(work, { recursive: true, force: true })
}

function launcherScript(targetPlatform) {
  if (targetPlatform === 'windows') {
    return `@echo off\r
set ROOT=%~dp0\r
"%ROOT%runtime\\node.exe" "%ROOT%app\\node_modules\\@agentclientprotocol\\codex-acp\\dist\\index.js" %*\r
`
  }
  return `#!/bin/sh
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
exec "$ROOT/runtime/node" "$ROOT/app/node_modules/@agentclientprotocol/codex-acp/dist/index.js" "$@"
`
}

async function download(url) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`download failed ${response.status} ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`)
}

async function directorySize(path) {
  let total = 0
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name)
    total += entry.isDirectory() ? await directorySize(child) : (await stat(child)).size
  }
  return total
}

async function materializeSymlinks(dir) {
  for (const name of await readdir(dir)) {
    const full = join(dir, name)
    const info = await lstat(full)
    if (info.isSymbolicLink()) {
      const target = await realpath(full)
      await rm(full)
      await cp(target, full, { recursive: true })
    } else if (info.isDirectory()) {
      await materializeSymlinks(full)
    }
  }
}

function zipDirectory(source, destination) {
  return new Promise((resolvePromise, reject) => {
    const outputStream = createWriteStream(destination)
    const archive = archiver('zip', { zlib: { level: 9 } })
    outputStream.on('close', resolvePromise)
    outputStream.on('error', reject)
    archive.on('error', reject)
    archive.pipe(outputStream)
    archive.directory(source, false)
    archive.finalize()
  })
}
