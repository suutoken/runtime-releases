import { createWriteStream } from 'node:fs'
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { brotliDecompressSync } from 'node:zlib'
import archiver from 'archiver'
import { artifactName, assertArch, assertExactSemver, assertPlatform } from './release-args.mjs'

const [version, platform, arch, outputArg] = process.argv.slice(2)
if (!version || !platform || !arch || !outputArg) {
  throw new Error('usage: package-grok <version> <platform> <arch> <output.zip>')
}
assertExactSemver(version)
assertPlatform(platform)
assertArch(arch)

const output = resolve(outputArg)
const expectedName = artifactName(version, platform, arch, 'grok')
if (basename(output) !== expectedName) {
  throw new Error(`output file must be named ${expectedName}`)
}

const npmName = grokNpmName(platform, arch)
const work = await mkdtemp(join(tmpdir(), 'suutoken-grok-'))
const npmDir = join(work, 'npm')
const root = join(work, 'out')
try {
  await mkdir(npmDir, { recursive: true })
  await mkdir(root, { recursive: true })
  const tarball = join(work, 'grok.tgz')
  await download(`https://registry.npmjs.org/${npmName}/-/${basename(npmName)}-${version}.tgz`, tarball)
  run('tar', ['-xzf', tarball, '-C', npmDir])
  const br = join(npmDir, 'package', 'bin', platform === 'windows' ? 'grok.exe.br' : 'grok.br')
  const unpacked = join(root, platform === 'windows' ? 'grok.exe' : 'grok')
  const compressed = await readFile(br)
  await writeFile(unpacked, brotliDecompressSync(compressed))
  if (platform !== 'windows') {
    await chmod(unpacked, 0o755)
  }
  await mkdir(dirname(output), { recursive: true })
  await zipDirectory(root, output)
  await writeFile(`${output}.metadata.json`, JSON.stringify({
    componentId: 'grok',
    version,
    platform,
    arch,
    file: basename(output),
    compressedSize: (await stat(output)).size,
    uncompressedSize: (await stat(unpacked)).size,
  }, null, 2))
} finally {
  await rm(work, { recursive: true, force: true })
}

function grokNpmName(platform, arch) {
  const names = {
    'linux-x86_64': '@xai-official/grok-linux-x64',
    'linux-aarch64': '@xai-official/grok-linux-arm64',
    'windows-x86_64': '@xai-official/grok-win32-x64',
    'windows-aarch64': '@xai-official/grok-win32-arm64',
    'macos-x86_64': '@xai-official/grok-darwin-x64',
    'macos-aarch64': '@xai-official/grok-darwin-arm64',
  }
  const name = names[`${platform}-${arch}`]
  if (!name) throw new Error(`no official Grok Build binary for ${platform}-${arch}`)
  return name
}

async function download(url, dest) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`download failed ${response.status} ${url}`)
  await writeFile(dest, Buffer.from(await response.arrayBuffer()))
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`)
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
