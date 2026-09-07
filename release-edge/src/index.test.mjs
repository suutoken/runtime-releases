import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import worker from './index.js'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('serves only the stable manifest and fixed versioned Windows artifact', async () => {
  const requested = []
  globalThis.fetch = async (url) => {
    requested.push(String(url))
    return new Response('ok', { status: 200 })
  }

  const latest = await worker.fetch(new Request('https://releases.suutoken.com/desktop/stable/latest.json'))
  assert.equal(latest.status, 200)
  assert.equal(latest.headers.get('cache-control'), 'no-cache')

  const artifact = await worker.fetch(new Request('https://releases.suutoken.com/desktop/artifacts/0.1.1/SuuToken-windows-x86_64-setup.exe'))
  assert.equal(artifact.status, 200)
  assert.match(requested[1], /releases\/download\/desktop-v0\.1\.1\/SuuToken-windows-x86_64-setup\.exe$/)

  const portable = await worker.fetch(new Request('https://releases.suutoken.com/desktop/artifacts/0.1.1/SuuToken-portable-windows-x86_64.exe'))
  assert.equal(portable.status, 200)
  assert.match(requested[2], /releases\/download\/desktop-v0\.1\.1\/SuuToken-portable-windows-x86_64\.exe$/)

  assert.equal((await worker.fetch(new Request('https://releases.suutoken.com/anything'))).status, 404)
  assert.equal((await worker.fetch(new Request('https://releases.suutoken.com/desktop/artifacts/..%2Fsecret/SuuToken-windows-x86_64-setup.exe'))).status, 404)
  assert.equal((await worker.fetch(new Request('https://releases.suutoken.com/desktop/stable/latest.json', { method: 'POST' }))).status, 405)
})
