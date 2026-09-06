import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { includeHiddenModels } from './codex-acp-patch.mjs'

const original = 'const response = await this.codexClient.listModels({ cursor, limit: null });'
test('includes hidden models without changing pagination', () => {
  assert.equal(includeHiddenModels(original, '1.10.0'),
    'const response = await this.codexClient.listModels({ cursor, limit: null, includeHidden: true });')
})
test('fails closed on upstream drift, duplicate matches, and repeated patches', () => {
  assert.throws(() => includeHiddenModels(original, '1.11.0'))
  assert.throws(() => includeHiddenModels('different source', '1.10.0'))
  assert.throws(() => includeHiddenModels(original + original, '1.10.0'))
  assert.throws(() => includeHiddenModels(includeHiddenModels(original, '1.10.0'), '1.10.0'))
})
