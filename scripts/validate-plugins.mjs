import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertComponent, assertConfigVersion, assertExactSemver } from './release-args.mjs'

export const DEFAULT_ARTIFACT =
  '{id}-v{version}-c{configVersion}/{id}-{version}-{platform}-{arch}.zip'
const COMPONENTS = ['opencodex', 'codex', 'grok']
const PLACEHOLDERS = ['id', 'version', 'configVersion', 'platform', 'arch']

export function validatePluginCatalog(parsed) {
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('plugin catalog must be an object')
  }
  const allowed = new Set(['schemaVersion', 'version', 'setup', 'artifact', 'plugins'])
  for (const key of Object.keys(parsed)) {
    if (!allowed.has(key)) throw new Error(`plugin catalog has unknown field ${key}`)
  }
  if (parsed.schemaVersion !== 1) throw new Error('plugin catalog schemaVersion must be 1')
  if (!Number.isSafeInteger(parsed.version) || parsed.version < 1) {
    throw new Error('plugin catalog version must be a positive integer')
  }
  assertSetup(parsed.setup)
  const artifact = parsed.artifact ?? DEFAULT_ARTIFACT
  assertArtifactTemplate(artifact)
  const plugins = parsed.plugins
  if (plugins == null || typeof plugins !== 'object' || Array.isArray(plugins)) {
    throw new Error('plugin catalog plugins must be an object')
  }
  const ids = Object.keys(plugins)
  if (ids.length !== COMPONENTS.length || COMPONENTS.some((id) => !ids.includes(id))) {
    throw new Error(`plugin catalog must list exactly ${COMPONENTS.join(', ')}`)
  }
  for (const id of COMPONENTS) {
    validatePlugin(id, plugins[id])
  }
}

function validatePlugin(id, plugin) {
  assertComponent(id)
  if (plugin == null || typeof plugin !== 'object' || Array.isArray(plugin)) {
    throw new Error(`${id} plugin must be an object`)
  }
  const allowed = new Set(['version', 'configVersion', 'setup', 'artifact'])
  for (const key of Object.keys(plugin)) {
    if (!allowed.has(key)) {
      throw new Error(`${id} plugin has unknown field ${key}; install and start stay in the app`)
    }
  }
  assertExactSemver(plugin.version)
  assertConfigVersion(plugin.configVersion)
  if (plugin.setup !== undefined) assertSetup(plugin.setup)
  if (plugin.artifact !== undefined) assertArtifactTemplate(plugin.artifact)
}

export function resolveArtifactUrl(catalog, id, platform, arch) {
  validatePluginCatalog(catalog)
  const plugin = catalog.plugins[id]
  const setup = (plugin.setup ?? catalog.setup).replace(/\/+$/, '')
  const template = plugin.artifact ?? catalog.artifact ?? DEFAULT_ARTIFACT
  const path = template
    .replaceAll('{id}', id)
    .replaceAll('{version}', plugin.version)
    .replaceAll('{configVersion}', String(plugin.configVersion))
    .replaceAll('{platform}', platform)
    .replaceAll('{arch}', arch)
  return `${setup}/${path}`
}

function assertSetup(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1024) {
    throw new Error('setup must be an https URL prefix')
  }
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`setup is not a URL: ${value}`)
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.port
    || parsed.search
    || parsed.hash
    || parsed.pathname.includes('..')
    || parsed.pathname.includes('\\')
  ) {
    throw new Error(`setup is not an allowed https prefix: ${value}`)
  }
}

function assertArtifactTemplate(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256) {
    throw new Error('artifact template is invalid')
  }
  if (value.includes('..') || value.includes('\\') || value.includes('?') || value.includes('#')) {
    throw new Error('artifact template contains a disallowed character')
  }
  let remaining = value
  for (const name of PLACEHOLDERS) {
    remaining = remaining.replaceAll(`{${name}}`, 'x')
  }
  if (remaining.includes('{') || remaining.includes('}')) {
    throw new Error('artifact template has an unknown placeholder')
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (invokedDirectly) {
  const input = process.argv[2]
  if (!input) throw new Error('usage: validate-plugins <plugins.json>')
  const parsed = JSON.parse(await readFile(resolve(input), 'utf8'))
  validatePluginCatalog(parsed)
}
