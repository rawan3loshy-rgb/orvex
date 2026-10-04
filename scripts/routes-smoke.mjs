// Runs the ORVEX domain self-test in Node through Vite's SSR module loader
// (resolves the @/ alias and TypeScript). Usage: node scripts/selftest.mjs
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
try {
  const mod = await server.ssrLoadModule('/src/mock/installation/routesSmoke.ts')
  console.log(await mod.routesSmoke())
} finally {
  await server.close()
}
