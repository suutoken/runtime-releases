import { createWriteStream } from 'node:fs'
import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import archiver from 'archiver'
import { artifactName, assertArch, assertExactSemver, assertPlatform } from './release-args.mjs'
import { verifyCodexDownload, verifySha256 } from './upstream-verify.mjs'

const [version, platform, arch, outputArg] = process.argv.slice(2)
if (!version || !platform || !arch || !outputArg) {
  throw new Error('usage: package-codex <version> <platform> <arch> <output.zip>')
}
assertExactSemver(version)
assertPlatform(platform)
assertArch(arch)

const output = resolve(outputArg)
const expectedName = artifactName(version, platform, arch, 'codex')
if (basename(output) !== expectedName) {
  throw new Error(`output file must be named ${expectedName}`)
}

const asset = codexAsset(version, platform, arch)
const work = await mkdtemp(join(tmpdir(), 'suutoken-codex-'))
const root = join(work, 'package')
try {
  await mkdir(root, { recursive: true })
  const archive = join(work, asset)
  const url = `https://github.com/openai/codex/releases/download/rust-v${version}/${asset}`
  const bytes = await download(url)
  const lock = verifyCodexDownload(bytes, version, platform, arch)
  if (lock.asset !== asset || lock.url !== url) {
    throw new Error(`Codex lock does not match ${platform}-${arch} asset URL`)
  }
  await writeFile(archive, bytes)
  extractArchive(archive, work, platform)
  const binaryName = platform === 'windows' ? 'codex.exe' : 'codex'
  const found = findExtractedBinary(work, platform)
  const dest = join(root, binaryName)
  run('cp', [found, dest])
  if (platform !== 'windows') {
    await chmod(dest, 0o755)
  }
  const hostAsset = asset.replace(/^codex-/, 'codex-code-mode-host-')
  const hostUrl = `https://github.com/openai/codex/releases/download/rust-v${version}/${hostAsset}`
  const hostBytes = await download(hostUrl)
  verifySha256(hostBytes, lock.codeModeHostSha256)
  const hostArchive = join(work, hostAsset)
  await writeFile(hostArchive, hostBytes)
  const hostExtract = join(work, 'host')
  await mkdir(hostExtract)
  extractArchive(hostArchive, hostExtract, platform)
  const hostName = platform === 'windows' ? 'codex-code-mode-host.exe' : 'codex-code-mode-host'
  const hostDest = join(root, hostName)
  run('cp', [join(hostExtract, hostAsset.replace(/\.(tar\.gz|zip)$/, '')), hostDest])
  if (platform !== 'windows') await chmod(hostDest, 0o755)
  await mkdir(dirname(output), { recursive: true })
  await zipDirectory(root, output)
  await writeFile(`${output}.metadata.json`, JSON.stringify({
    componentId: 'codex',
    version,
    platform,
    arch,
    file: basename(output),
    compressedSize: (await stat(output)).size,
    uncompressedSize: (await stat(dest)).size + (await stat(hostDest)).size,
    codeModeHost: { upstreamUrl: hostUrl, upstreamSha256: lock.codeModeHostSha256 },
    upstreamUrl: lock.url,
    upstreamAsset: lock.asset,
    upstreamSha256: lock.sha256,
  }, null, 2))
} finally {
  await rm(work, { recursive: true, force: true })
}

function codexAsset(version, platform, arch) {
  const triples = {
    'linux-x86_64': 'x86_64-unknown-linux-musl.tar.gz',
    'linux-aarch64': 'aarch64-unknown-linux-musl.tar.gz',
    'macos-x86_64': 'x86_64-apple-darwin.tar.gz',
    'macos-aarch64': 'aarch64-apple-darwin.tar.gz',
    'windows-x86_64': 'x86_64-pc-windows-msvc.exe.zip',
    'windows-aarch64': 'aarch64-pc-windows-msvc.exe.zip',
  }
  const suffix = triples[`${platform}-${arch}`]
  if (!suffix) throw new Error(`no official Codex binary for ${platform}-${arch}`)
  return `codex-${suffix}`
}

async function download(url) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`download failed ${response.status} ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

function extractArchive(archive, dest, platform) {
  if (platform === 'windows') {
    run('unzip', ['-o', archive, '-d', dest])
  } else {
    run('tar', ['-xzf', archive, '-C', dest])
  }
}

function findExtractedBinary(dir, platform) {
  const result = spawnSync('bash', ['-lc', `find ${JSON.stringify(dir)} -type f \\( -name 'codex' -o -name 'codex.exe' -o -name 'codex-*' \\) ! -name '*.tar.gz' ! -name '*.zip' ! -name '*.zst' ! -name '*.sigstore' | head -1`], {
    encoding: 'utf8',
  })
  const path = result.stdout.trim()
  if (!path) throw new Error('extracted Codex binary not found')
  if (platform !== 'windows') run('chmod', ['755', path])
  return path
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
