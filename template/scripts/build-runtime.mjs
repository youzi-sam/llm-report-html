import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const assets = join(dist, 'assets')

const packs = [
  ['reactive', 'src/packs/reactive.js'],
  ['diagram-dagre', 'src/packs/diagram-dagre.js'],
  ['diagram-quadrant', 'src/packs/diagram-quadrant.js'],
  ['diagram-sequence', 'src/packs/diagram-sequence.js'],
  ['core', 'src/packs/core.js'],
]

rmSync(dist, { recursive: true, force: true })
mkdirSync(assets, { recursive: true })

for (const [name, entry] of packs) {
  const outDir = join(dist, `.build-${name}`)
  await build({
    root,
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir,
      emptyOutDir: true,
      target: 'es2022',
      minify: 'esbuild',
      cssCodeSplit: false,
      assetsInlineLimit: 100000000,
      lib: {
        entry: resolve(root, entry),
        name: globalName(name),
        formats: ['iife'],
        fileName: () => `${name}.js`,
      },
    },
  })
  copyFirst(outDir, '.js', join(assets, `${name}.js`))
  copyOptional(outDir, '.css', join(assets, `${name}.css`))
  rmSync(outDir, { recursive: true, force: true })
}

writeFileSync(join(dist, 'index.html'), `<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Report</title>
  <style>__REPORT_CSS__</style>
</head>
<body>
  <main id="root"></main>
  <script type="application/json" id="report-data">__REPORT_DATA__</script>
  <script type="application/json" id="report-render-data">__REPORT_RENDER_DATA__</script>
__REPORT_RUNTIME__
</body>
</html>
`)

function copyFirst(dir, suffix, target) {
  const found = findFiles(dir).filter(path => path.endsWith(suffix)).sort()
  if (found.length === 0) throw new Error(`missing ${suffix} output in ${dir}`)
  cpSync(found[0], target)
}

function copyOptional(dir, suffix, target) {
  const found = findFiles(dir).filter(path => path.endsWith(suffix)).sort()
  if (found.length > 0) cpSync(found[0], target)
}

function findFiles(dir) {
  const out = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name)
    if (name.isDirectory()) out.push(...findFiles(path))
    else out.push(path)
  }
  return out
}

function globalName(name) {
  return 'LRH_' + name.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()
}
