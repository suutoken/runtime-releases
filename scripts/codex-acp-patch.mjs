// Pinned compatibility patch until the adapter exposes model visibility itself.
export function includeHiddenModels(source, version) {
  if (version !== '1.10.0') throw new Error('Review the includeHidden patch for this Codex ACP version')
  const before = 'this.codexClient.listModels({ cursor, limit: null })'
  if (source.split(before).length !== 2) {
    throw new Error('Codex ACP model discovery changed; refusing an ambiguous patch')
  }
  return source.replace(before, 'this.codexClient.listModels({ cursor, limit: null, includeHidden: true })')
}
