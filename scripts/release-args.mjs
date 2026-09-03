export const PLATFORMS = ['linux', 'windows', 'macos']
export const ARCHES = ['x86_64', 'aarch64']
export const CHANNELS = ['stable', 'preview']

const NUMERIC = '(0|[1-9]\\d*)'
const EXACT_SEMVER = new RegExp(`^${NUMERIC}\\.${NUMERIC}\\.${NUMERIC}$`)
const POSITIVE_INT = /^[1-9]\d*$/
const MAX_CONFIG_VERSION = 4294967295
const ARTIFACT = new RegExp(
  `^opencodex-${NUMERIC}\\.${NUMERIC}\\.${NUMERIC}-(linux|windows|macos)-(x86_64|aarch64)\\.zip$`,
)

export function assertExactSemver(version) {
  if (typeof version !== 'string' || !EXACT_SEMVER.test(version)) {
    throw new Error(`version must be an exact MAJOR.MINOR.PATCH semver, got ${JSON.stringify(version)}`)
  }
}

export function assertConfigVersion(value) {
  const text = String(value ?? '')
  if (!POSITIVE_INT.test(text)) {
    throw new Error(`config version must be a positive integer, got ${JSON.stringify(value)}`)
  }
  const parsed = Number(text)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_CONFIG_VERSION) {
    throw new Error(`config version must be an integer in 1..=${MAX_CONFIG_VERSION}, got ${JSON.stringify(value)}`)
  }
  return parsed
}

export function assertPlatform(platform) {
  if (!PLATFORMS.includes(platform)) {
    throw new Error(`unsupported platform ${JSON.stringify(platform)}`)
  }
}

export function assertArch(arch) {
  if (!ARCHES.includes(arch)) {
    throw new Error(`unsupported arch ${JSON.stringify(arch)}`)
  }
}

export function assertChannel(channel) {
  if (!CHANNELS.includes(channel)) {
    throw new Error(`unsupported channel ${JSON.stringify(channel)}`)
  }
}

export function artifactName(version, platform, arch) {
  assertExactSemver(version)
  assertPlatform(platform)
  assertArch(arch)
  return `opencodex-${version}-${platform}-${arch}.zip`
}

export function parseArtifactName(file) {
  if (typeof file !== 'string' || !ARTIFACT.test(file)) {
    throw new Error(`artifact file name is invalid: ${JSON.stringify(file)}`)
  }
  const [, major, minor, patch, platform, arch] = ARTIFACT.exec(file)
  return { version: `${major}.${minor}.${patch}`, platform, arch }
}
