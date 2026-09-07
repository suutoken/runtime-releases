const LATEST_PATH = '/desktop/stable/latest.json'
const LATEST_SOURCE = 'https://raw.githubusercontent.com/suutoken/runtime-releases/main/desktop/stable/latest.json'
const ARTIFACT_PATH = /^\/desktop\/artifacts\/(\d+\.\d+\.\d+)\/(SuuToken-windows-x86_64-setup\.exe|SuuToken-portable-windows-x86_64\.exe)$/

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
    }

    const { pathname } = new URL(request.url)
    if (pathname === LATEST_PATH) {
      const upstream = await fetch(LATEST_SOURCE, { redirect: 'follow' })
      if (!upstream.ok) return new Response('release metadata unavailable', { status: 502 })
      return proxy(upstream, request.method, 'no-cache', 'application/json; charset=utf-8')
    }

    const match = ARTIFACT_PATH.exec(pathname)
    if (!match) return new Response('not found', { status: 404 })
    const upstream = await fetch(
      `https://github.com/suutoken/runtime-releases/releases/download/desktop-v${match[1]}/${match[2]}`,
      { method: request.method, redirect: 'follow' },
    )
    if (!upstream.ok) return new Response('release artifact unavailable', { status: 502 })
    return proxy(upstream, request.method, 'public, max-age=31536000, immutable', 'application/octet-stream')
  },
}

function proxy(upstream, method, cacheControl, contentType) {
  const headers = new Headers()
  headers.set('cache-control', cacheControl)
  headers.set('content-type', contentType)
  headers.set('x-content-type-options', 'nosniff')
  const length = upstream.headers.get('content-length')
  if (length) headers.set('content-length', length)
  return new Response(method === 'HEAD' ? null : upstream.body, {
    status: 200,
    headers,
  })
}
