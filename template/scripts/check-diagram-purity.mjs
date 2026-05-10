import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const forbidden = ['mer', 'maid'].join('')
const roots = [
  'README.md',
  'Makefile',
  'cmd',
  'examples',
  'internal',
  'recipes',
  'template',
  '.claude',
]
const ignored = new Set([
  'bin',
  'template/node_modules',
  'template/dist',
  'internal/render/html/template.html',
])

const failures = []
for (const root of roots) walk(resolve(root))

if (failures.length > 0) {
  console.error('diagram purity check failed: forbidden backend token remains')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('diagram-purity-check ok')

function walk(path) {
  const rel = normalize(relative(process.cwd(), path))
  if (!rel || ignored.has(rel) || [...ignored].some(prefix => rel.startsWith(`${prefix}/`))) return
  if (rel.split('/').includes('node_modules')) return

  const st = statSync(path, { throwIfNoEntry: false })
  if (!st) return
  if (st.isDirectory()) {
    for (const entry of readdirSync(path)) walk(resolve(path, entry))
    return
  }
  if (!st.isFile() || looksBinary(path)) return

  const text = readFileSync(path, 'utf8')
  const lines = text.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(forbidden)) failures.push(`${rel}:${index + 1}`)
  })
}

function looksBinary(path) {
  return /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|otf)$/i.test(path)
}

function normalize(path) {
  return path.split('\\').join('/')
}
