import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = import.meta.dirname
const STORE = resolve(ROOT, 'annotations.local.json')
const PRED = resolve(ROOT, 'public/predictions.json')

/**
 * Dev-only persistence, so annotations live in a file on disk rather than being
 * trapped in one browser profile's localStorage (which cost us a whole afternoon
 * once — the tab you're looking at isn't always the tab the tooling can see).
 *
 * Production is a static bundle: these routes simply don't exist, the fetches
 * fail, and the app falls back to localStorage. No backend required to deploy.
 */
function devApi() {
  return {
    name: 'annotator-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/load', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(existsSync(STORE) ? readFileSync(STORE, 'utf8') : '{}')
      })
      // Predictions are runtime data, not a module — Vite's HMR can't see them,
      // so the client polls this to hot-apply a newly published page.
      server.middlewares.use('/api/version', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ pred: existsSync(PRED) ? Math.round(statSync(PRED).mtimeMs) : 0 }))
      })
      server.middlewares.use('/api/save', (req, res) => {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            writeFileSync(STORE, body)
            res.setHeader('Content-Type', 'application/json')
            res.end('{"ok":true}')
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      })
    }
  }
}

/**
 * Page scans are copyrighted publication content — gitignored, present locally
 * only so the sample runs in dev. Vite copies publicDir wholesale, so a local
 * `npm run build` would happily sweep 26MB of newsprint into a deployable
 * bundle. CI never has them (they aren't in the repo), but the trap shouldn't
 * exist at all: strip them from dist explicitly.
 */
function stripPageScans() {
  return {
    name: 'strip-page-scans',
    apply: 'build',
    closeBundle() {
      const base = resolve(ROOT, 'dist/samples')
      if (!existsSync(base)) return
      for (const d of readdirSync(base, { withFileTypes: true })) {
        if (!d.isDirectory()) continue
        const pages = resolve(base, d.name, 'pages')
        if (existsSync(pages)) {
          rmSync(pages, { recursive: true, force: true })
          console.log(`[strip-page-scans] removed samples/${d.name}/pages from dist`)
        }
      }
    }
  }
}

export default defineConfig({
  plugins: [vue(), devApi(), stripPageScans()],
  // relative base → works both on a Pages subpath and a custom domain
  base: './',
  server: { port: 8000 },
  build: { outDir: 'dist', emptyOutDir: true }
})
