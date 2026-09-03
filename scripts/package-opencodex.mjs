import archiver from 'archiver'
import { createWriteStream } from 'node:fs'
import { chmod, cp, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { artifactName, assertArch, assertExactSemver, assertPlatform } from './release-args.mjs'

const [version, platform, arch, outputArg] = process.argv.slice(2)
if (!version || !platform || !arch || !outputArg) {
  throw new Error('usage: package-opencodex <version> <platform> <arch> <output.zip>')
}
assertExactSemver(version)
assertPlatform(platform)
assertArch(arch)

const output = resolve(outputArg)
const expectedName = artifactName(version, platform, arch)
if (basename(output) !== expectedName) {
  throw new Error(`output file must be named ${expectedName}`)
}
const work = await mkdtemp(join(tmpdir(), 'suutoken-opencodex-'))
const root = join(work, 'package')
const app = join(root, 'app')
const runtime = join(root, 'runtime')

try {
  await mkdir(app, { recursive: true })
  await mkdir(runtime, { recursive: true })
  await writeFile(join(app, 'package.json'), JSON.stringify({
    private: true,
    dependencies: { '@bitkyc08/opencodex': version },
  }, null, 2))
  run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], app)

  const upstream = join(app, 'node_modules', '@bitkyc08', 'opencodex')
  await rm(join(upstream, 'gui'), { recursive: true, force: true })
  await cp(process.execPath, join(runtime, platform === 'windows' ? 'node.exe' : 'node'))

  const launcherName = platform === 'windows' ? 'opencodex.exe' : 'opencodex'
  const launcherSource = join('target', 'release', launcherName)
  await cp(launcherSource, join(root, launcherName))
  if (platform !== 'windows') {
    await chmod(join(root, launcherName), 0o755)
    await chmod(join(runtime, 'node'), 0o755)
  }

  await mkdir(dirname(output), { recursive: true })
  const uncompressedSize = await directorySize(root)
  await zipDirectory(root, output)
  await writeFile(`${output}.metadata.json`, JSON.stringify({
    componentId: 'opencodex',
    version,
    platform,
    arch,
    file: basename(output),
    compressedSize: (await stat(output)).size,
    uncompressedSize,
  }, null, 2))
} finally {
  await rm(work, { recursive: true, force: true })
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: platform === 'windows' })
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`)
}

async function directorySize(path) {
  const { readdir } = await import('node:fs/promises')
  let total = 0
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name)
    total += entry.isDirectory() ? await directorySize(child) : (await stat(child)).size
  }
  return total
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

