#!/usr/bin/env node
/**
 * ORVEX prototype: production static server.
 *
 * Serves the built single-page app (dist/) with zero dependencies, using only
 * Node.js 22 built-ins.
 *
 *   npm run build && npm start        → http://localhost:8080
 *
 *   - SPA fallback: unknown extension-less paths (/admin/orders, /site/about…)
 *     get index.html; missing files with an extension get a real 404.
 *   - Compression: serves precompressed siblings (file.br / file.gz) when they
 *     exist, otherwise compresses text assets on the fly once and caches them.
 *   - Caching: hashed /assets/* are immutable for a year; index.html is
 *     revalidated on every navigation (ETag → 304).
 *   - Security headers: CSP (inline-script hashes computed from index.html),
 *     frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP.
 *   - GET /healthz → {"status":"ok","version":"0.1.0","uptime":123}
 *   - Graceful shutdown on SIGTERM/SIGINT (stops accepting, drains, exits).
 *
 * Environment:
 *   PORT                     default 8080
 *   HOST                     default 127.0.0.1 (the Docker image sets 0.0.0.0)
 *   STATIC_DIR               default <repo>/dist
 *   APP_VERSION              default: "version" from package.json
 *   CSP_CONNECT_SRC          extra origins for connect-src (space separated)
 *   CONTENT_SECURITY_POLICY  replaces the generated policy entirely
 *   TRUST_PROXY=1            trust X-Forwarded-Proto (enables HSTS behind TLS)
 *   ACCESS_LOG=0             disable JSON access logs
 *   SHUTDOWN_TIMEOUT_MS      default 10000
 *
 * In the product, ORVEX Core's core-api container serves the admin SPA,
 * the public website and the APIs. This file only serves the prototype.
 */
import { createServer } from 'node:http'
import { createReadStream, readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { brotliCompress, constants as zc, gzip } from 'node:zlib'

/* ------------------------------------------------------------------------ */
/* Configuration                                                            */
/* ------------------------------------------------------------------------ */
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? join(REPO_ROOT, 'dist'))
const PORT = Number.parseInt(process.env.PORT ?? '8080', 10)
const HOST = process.env.HOST ?? '127.0.0.1'
const VERSION = process.env.APP_VERSION ?? readPackageVersion()
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true'
const ACCESS_LOG = process.env.ACCESS_LOG !== '0' && process.env.ACCESS_LOG !== 'false'
const SHUTDOWN_TIMEOUT_MS = Number.parseInt(process.env.SHUTDOWN_TIMEOUT_MS ?? '10000', 10)
const STARTED_AT = Date.now()

const brotli = promisify(brotliCompress)
const gz = promisify(gzip)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
}
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.map', '.webmanifest', '.txt', '.xml', '.svg', '.ttf', '.otf', '.wasm'])
const MIN_COMPRESS_BYTES = 1024
const MAX_COMPRESS_BYTES = 16 * 1024 * 1024
const COMPRESSION_CACHE_LIMIT = 64 * 1024 * 1024
/** Vite emits content-hashed file names under /assets (index-B1x9Qe3a.js). */
const HASHED_ASSET = /^\/assets\/.+[.-][A-Za-z0-9_-]{8,}\.[a-z0-9]+$/

function readPackageVersion() {
  try {
    return JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/* ------------------------------------------------------------------------ */
/* index.html + Content-Security-Policy                                     */
/* ------------------------------------------------------------------------ */
let indexCache = null // { mtimeMs, body, etag, csp }
const NONCE_PLACEHOLDER = '__CSP_NONCE__'

function originOf(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null
  } catch {
    return null
  }
}

function buildCsp(inlineScriptHashes) {
  if (process.env.CONTENT_SECURITY_POLICY) return process.env.CONTENT_SECURITY_POLICY
  // When VITE_API_MODE=http the SPA calls the installation / vendor APIs.
  const connect = new Set(["'self'"])
  for (const v of [process.env.VITE_INSTALLATION_API_URL, process.env.VITE_VENDOR_API_URL]) {
    const o = v && originOf(v)
    if (o) connect.add(o)
  }
  for (const o of (process.env.CSP_CONNECT_SRC ?? '').split(/\s+/).filter(Boolean)) connect.add(o)
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `script-src 'self' ${inlineScriptHashes.map((h) => `'${h}'`).join(' ')}`.trim(),
    // React/motion style attributes and CodeMirror's injected <style> need inline styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${[...connect].join(' ')}`,
    // Website-builder previews render in same-origin / blob: sandboxed frames.
    "frame-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ')
}

/** Hash every inline <script> (no src) of index.html so CSP can allow exactly those. */
function inlineScriptHashes(html) {
  const hashes = []
  const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi
  for (const m of html.matchAll(re)) {
    if (m[1].trim()) hashes.push(`sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}`)
  }
  return hashes
}

async function loadIndex() {
  const file = join(STATIC_DIR, 'index.html')
  const st = await stat(file)
  if (indexCache && indexCache.mtimeMs === st.mtimeMs) return indexCache
  const body = await readFile(file)
  indexCache = {
    mtimeMs: st.mtimeMs,
    body,
    etag: `"${createHash('sha1').update(body).digest('base64url')}"`,
    csp: buildCsp(inlineScriptHashes(body.toString('utf8'))),
  }
  return indexCache
}

function currentCsp() {
  return indexCache?.csp ?? buildCsp([])
}


/* ------------------------------------------------------------------------ */
/* Response helpers                                                         */
/* ------------------------------------------------------------------------ */
let shuttingDown = false

function securityHeaders(req) {
  const h = {
    'Content-Security-Policy': currentCsp(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  }
  if (TRUST_PROXY && String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https') {
    h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
  }
  if (shuttingDown) h.Connection = 'close'
  return h
}

function send(req, res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body ?? '')
  const all = { ...securityHeaders(req), ...headers }
  if (status === 304) delete all['Content-Length']
  else all['Content-Length'] = buf.length
  res.writeHead(status, all)
  const withBody = req.method !== 'HEAD' && status !== 304
  res.bodyBytes = withBody ? buf.length : 0
  res.end(withBody ? buf : undefined)
}

function sendJson(req, res, status, obj, headers = {}) {
  send(req, res, status, JSON.stringify(obj), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  })
}

/** Parse Accept-Encoding and pick br > gzip (respecting q=0). */
function pickEncoding(header) {
  const accepted = new Map()
  for (const part of String(header ?? '').split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';')
    if (!name) continue
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
    accepted.set(name, q ? Number.parseFloat(q.slice(2)) : 1)
  }
  const ok = (enc) => (accepted.get(enc) ?? accepted.get('*') ?? 0) > 0
  if (ok('br')) return 'br'
  if (ok('gzip')) return 'gzip'
  return null
}

function cacheControlFor(urlPath) {
  if (HASHED_ASSET.test(urlPath)) return 'public, max-age=31536000, immutable'
  return 'public, max-age=3600'
}

/** Weak comparison as required for If-None-Match (RFC 9110 §13.1.2). */
function isFresh(req, etag) {
  const inm = req.headers['if-none-match']
  if (!inm) return false
  const bare = (t) => t.trim().replace(/^W\//, '')
  return inm.split(',').some((t) => bare(t) === '*' || bare(t) === bare(etag))
}

/* ------------------------------------------------------------------------ */
/* Static files                                                             */
/* ------------------------------------------------------------------------ */
const compressionCache = new Map() // key → Buffer
let compressionCacheBytes = 0

function rememberCompressed(key, buf) {
  if (buf.length > COMPRESSION_CACHE_LIMIT / 4) return
  compressionCache.set(key, buf)
  compressionCacheBytes += buf.length
  for (const [k, v] of compressionCache) {
    if (compressionCacheBytes <= COMPRESSION_CACHE_LIMIT) break
    compressionCache.delete(k)
    compressionCacheBytes -= v.length
  }
}

async function compressed(absPath, st, encoding) {
  const key = `${absPath}:${st.mtimeMs}:${st.size}:${encoding}`
  const hit = compressionCache.get(key)
  if (hit) return hit
  const raw = await readFile(absPath)
  const out =
    encoding === 'br'
      ? await brotli(raw, { params: { [zc.BROTLI_PARAM_QUALITY]: 9, [zc.BROTLI_PARAM_SIZE_HINT]: raw.length } })
      : await gz(raw, { level: 9 })
  rememberCompressed(key, out)
  return out
}

async function statFile(absPath) {
  try {
    const st = await stat(absPath)
    return st.isFile() ? st : null
  } catch {
    return null
  }
}

/** Resolve a URL path inside STATIC_DIR; null if it escapes or touches a dotfile. */
function resolveStatic(urlPath) {
  if (urlPath.includes('\0')) return null
  const rel = normalize(urlPath).replace(/^([/\\])+/, '')
  if (rel.split(/[/\\]/).some((seg) => seg.startsWith('.'))) return null
  const abs = resolve(STATIC_DIR, rel)
  if (abs !== STATIC_DIR && !abs.startsWith(STATIC_DIR + sep)) return null
  return abs
}

async function serveFile(req, res, urlPath, absPath, st) {
  const ext = extname(absPath).toLowerCase()
  const type = MIME[ext] ?? 'application/octet-stream'
  const cacheControl = cacheControlFor(urlPath)
  const canCompress = COMPRESSIBLE.has(ext) && st.size >= MIN_COMPRESS_BYTES
  const baseEtag = `"${st.size.toString(36)}-${Math.trunc(st.mtimeMs).toString(36)}"`
  const encoding = canCompress ? pickEncoding(req.headers['accept-encoding']) : null
  const headers = { 'Content-Type': type, 'Cache-Control': cacheControl }
  if (canCompress) headers.Vary = 'Accept-Encoding'

  // 1) Precompressed sibling (e.g. built with a compression plugin).
  if (encoding) {
    const sibling = await statFile(`${absPath}${encoding === 'br' ? '.br' : '.gz'}`)
    if (sibling) {
      const etag = `${baseEtag.slice(0, -1)}-${encoding}"`
      if (isFresh(req, etag)) return send(req, res, 304, '', { ...headers, ETag: etag })
      res.writeHead(200, { ...securityHeaders(req), ...headers, ETag: etag, 'Content-Encoding': encoding, 'Content-Length': sibling.size })
      if (req.method === 'HEAD') return res.end()
      res.bodyBytes = sibling.size
      return pipeline(createReadStream(`${absPath}${encoding === 'br' ? '.br' : '.gz'}`), res)
    }
  }

  // 2) On-the-fly compression for text assets, cached in memory.
  if (encoding && st.size <= MAX_COMPRESS_BYTES) {
    const etag = `${baseEtag.slice(0, -1)}-${encoding}"`
    if (isFresh(req, etag)) return send(req, res, 304, '', { ...headers, ETag: etag })
    const body = await compressed(absPath, st, encoding)
    return send(req, res, 200, body, { ...headers, ETag: etag, 'Content-Encoding': encoding })
  }

  // 3) Identity.
  if (isFresh(req, baseEtag)) return send(req, res, 304, '', { ...headers, ETag: baseEtag })
  res.writeHead(200, { ...securityHeaders(req), ...headers, ETag: baseEtag, 'Content-Length': st.size })
  if (req.method === 'HEAD') return res.end()
  res.bodyBytes = st.size
  return pipeline(createReadStream(absPath), res)
}

async function serveIndex(req, res) {
  let index
  try {
    index = await loadIndex()
  } catch {
    return send(req, res, 503, 'The app has not been built yet. Run `npm run build`, then `npm start`.\n', {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '10',
    })
  }
  // Per-response CSP nonce. The SPA reads it from <meta name="csp-nonce"> and stamps it on
  // the scripts of website-builder sections rendered in sandboxed srcdoc iframes, which
  // inherit this document's policy. Everything else stays limited to 'self' + hashes.
  const html = index.body.toString('utf8')
  if (html.includes(NONCE_PLACEHOLDER) && !process.env.CONTENT_SECURITY_POLICY) {
    const nonce = randomBytes(16).toString('base64')
    const csp = index.csp.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`)
    return send(req, res, 200, html.replaceAll(NONCE_PLACEHOLDER, nonce), {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': csp,
    })
  }
  const encoding = pickEncoding(req.headers['accept-encoding'])
  // One ETag per representation (identity / br / gzip).
  const etag = encoding ? `${index.etag.slice(0, -1)}-${encoding}"` : index.etag
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ETag: etag, Vary: 'Accept-Encoding' }
  if (isFresh(req, etag)) return send(req, res, 304, '', headers)
  if (encoding) {
    const key = `index:${index.mtimeMs}:${encoding}`
    let body = compressionCache.get(key)
    if (!body) {
      body = encoding === 'br' ? await brotli(index.body) : await gz(index.body)
      rememberCompressed(key, body)
    }
    return send(req, res, 200, body, { ...headers, 'Content-Encoding': encoding })
  }
  return send(req, res, 200, index.body, headers)
}

/* ------------------------------------------------------------------------ */
/* Routing                                                                  */
/* ------------------------------------------------------------------------ */
async function health(req, res) {
  const uptime = Math.round((Date.now() - STARTED_AT) / 1000)
  if (shuttingDown) return sendJson(req, res, 503, { status: 'shutting_down', version: VERSION, uptime })
  try {
    await loadIndex()
    return sendJson(req, res, 200, { status: 'ok', version: VERSION, uptime })
  } catch {
    return sendJson(req, res, 503, { status: 'error', version: VERSION, uptime, error: 'dist/index.html not found' })
  }
}

async function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(req, res, 405, { error: { code: 'method_not_allowed', message: `${req.method} is not supported` } }, { Allow: 'GET, HEAD' })
  }

  let urlPath
  try {
    urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  } catch {
    return sendJson(req, res, 400, { error: { code: 'bad_request', message: 'Malformed URL' } })
  }

  if (urlPath === '/healthz') return health(req, res)

  // The prototype has no backend: make that explicit instead of returning the SPA.
  if (urlPath === '/api' || urlPath.startsWith('/api/')) {
    return sendJson(req, res, 404, {
      error: { code: 'route_not_found', message: 'This prototype server has no API. Build with VITE_API_MODE=mock, or point VITE_*_API_URL at a real backend.' },
    })
  }

  if (urlPath === '/' || urlPath === '/index.html') return serveIndex(req, res)

  const abs = resolveStatic(urlPath)
  if (!abs) return send(req, res, 404, 'Not found\n', { 'Content-Type': 'text/plain; charset=utf-8' })

  const st = await statFile(abs)
  if (st) return serveFile(req, res, urlPath, abs, st)

  // Missing file with an extension → real 404 (never mask broken asset links).
  const lastSegment = urlPath.slice(urlPath.lastIndexOf('/') + 1)
  if (lastSegment.includes('.')) {
    return send(req, res, 404, 'Not found\n', { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  }

  // Client-side route → SPA shell.
  return serveIndex(req, res)
}

/* ------------------------------------------------------------------------ */
/* Server lifecycle                                                         */
/* ------------------------------------------------------------------------ */
function log(fields) {
  process.stdout.write(`${JSON.stringify({ t: new Date().toISOString(), ...fields })}\n`)
}

const server = createServer((req, res) => {
  const t0 = process.hrtime.bigint()
  if (ACCESS_LOG) {
    res.on('finish', () => {
      if (req.url === '/healthz') return
      log({
        msg: 'request',
        method: req.method,
        path: req.url,
        status: res.statusCode,
        ms: Number((process.hrtime.bigint() - t0) / 1000n) / 1000,
        bytes: res.bodyBytes ?? 0,
      })
    })
  }
  handle(req, res).catch((err) => {
    if (err?.code === 'ERR_STREAM_PREMATURE_CLOSE') return // client went away
    log({ msg: 'error', path: req.url, error: String(err?.stack ?? err) })
    if (!res.headersSent) sendJson(req, res, 500, { error: { code: 'internal_error', message: 'Unexpected server error' } })
    else res.destroy()
  })
})

// Behind a load balancer / reverse proxy, keep idle sockets longer than the proxy does.
server.keepAliveTimeout = 65_000
server.headersTimeout = 66_000
server.requestTimeout = 30_000

server.on('error', (err) => {
  log({ msg: 'fatal', error: err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use on ${HOST}` : String(err) })
  process.exit(1)
})

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
  else socket.destroy(err)
})

server.listen(PORT, HOST, async () => {
  let built = true
  try {
    await loadIndex()
  } catch {
    built = false
  }
  log({ msg: 'listening', url: `http://${HOST.includes(':') ? `[${HOST}]` : HOST}:${PORT}`, version: VERSION, staticDir: STATIC_DIR, built })
  if (!built) log({ msg: 'warning', detail: 'dist/index.html not found; run `npm run build` first. /healthz reports 503 until then.' })
})

function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  log({ msg: 'shutting down', signal })
  server.close((err) => {
    log({ msg: 'stopped', error: err ? String(err) : undefined })
    process.exit(err ? 1 : 0)
  })
  server.closeIdleConnections()
  setTimeout(() => {
    log({ msg: 'forcing shutdown', afterMs: SHUTDOWN_TIMEOUT_MS })
    server.closeAllConnections()
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
