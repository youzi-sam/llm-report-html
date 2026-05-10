import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const htmlPath = process.argv[2]
if (!htmlPath) {
  console.error('usage: node template/scripts/check-rendered-diagrams.mjs <report.html>')
  process.exit(2)
}

const chrome = process.env.CHROME_BIN || findChrome()
if (!chrome) {
  console.error('Chrome is required for rendered diagram smoke. Set CHROME_BIN=/path/to/chrome.')
  process.exit(2)
}

const port = 9400 + Math.floor(Math.random() * 400)
const userDataDir = mkdtempSync(join(tmpdir(), 'llm-report-html-chrome-'))
const proc = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  `file://${htmlPath}`,
], { stdio: 'ignore' })

try {
  const page = await waitForPage(port)
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })

  let seq = 0
  const pending = new Map()
  ws.onmessage = event => {
    const msg = JSON.parse(event.data)
    if (!msg.id || !pending.has(msg.id)) return
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
  }
  const send = (method, params = {}) => {
    const id = ++seq
    ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
  }

  await send('Runtime.enable')
  await sleep(2200)
  const result = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const quadrantLabelCountMatches = block => {
        const points = block.querySelectorAll('.quadrant-svg-item')
        const labels = block.querySelectorAll('.quadrant-svg-item-label-group')
        return points.length === labels.length
      }
      const quadrantLabelMaxDistance = block => {
        const points = [...block.querySelectorAll('.quadrant-svg-item')]
        const labels = [...block.querySelectorAll('.quadrant-svg-item-label-group')]
        if (points.length === 0 || points.length !== labels.length) return 0
        return Math.max(...points.map((point, index) => {
          const pointRect = point.getBoundingClientRect()
          const labelRect = labels[index].getBoundingClientRect()
          const x = pointRect.left + pointRect.width / 2
          const y = pointRect.top + pointRect.height / 2
          const dx = Math.max(labelRect.left - x, 0, x - labelRect.right)
          const dy = Math.max(labelRect.top - y, 0, y - labelRect.bottom)
          return Math.hypot(dx, dy)
        }))
      }
      const blocks = [...document.querySelectorAll('.diagram-block')]
      const errors = [...document.querySelectorAll('.report-error')].map(node => node.textContent)
      return {
        errors,
        blocks: blocks.map(block => {
          const svg = block.querySelector('svg')
          const br = block.getBoundingClientRect()
          const sr = svg ? svg.getBoundingClientRect() : null
          return {
            cls: block.className,
            hasSvg: !!svg,
            isFlowSvg: !!block.querySelector('svg.flow-svg'),
            isQuadrantSvg: !!block.querySelector('svg.quadrant-svg'),
            isSequenceSvg: !!block.querySelector('svg.sequence-svg'),
            isStateSvg: !!block.querySelector('svg.state-svg'),
            isERSvg: !!block.querySelector('svg.er-svg'),
            isTreeSvg: !!block.querySelector('svg.tree-svg'),
            quadrantLabelMaxDistance: quadrantLabelMaxDistance(block),
            quadrantLabelCountMatches: quadrantLabelCountMatches(block),
            blockWidth: br.width,
            svgWidth: sr ? sr.width : 0,
            svgHeight: sr ? sr.height : 0,
          }
        }),
      }
    })()`,
  })

  const smoke = result.result.value
  const failures = renderedDiagramFailures(smoke)
  if (failures.length > 0) {
    console.error(`rendered diagram smoke failed: ${htmlPath}`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }
  console.log(`rendered-diagram-check ok (${smoke.blocks.length} diagrams)`)

  try {
    await send('Browser.close')
  } catch {
    // Browser.close is best-effort after smoke success; process cleanup below is authoritative.
  }
  ws.close()
} finally {
  await sleep(200)
  if (!proc.killed) proc.kill()
  rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}

function renderedDiagramFailures(smoke) {
  const failures = []
  if (smoke.errors.length > 0) failures.push(`report errors: ${smoke.errors.join(' | ')}`)
  if (smoke.blocks.length === 0) failures.push('no diagram blocks rendered')
  for (const [index, block] of smoke.blocks.entries()) {
    if (!block.hasSvg) failures.push(`diagram ${index} has no svg`)
    if (block.svgWidth <= 0 || block.svgHeight <= 0) failures.push(`diagram ${index} has empty svg geometry`)
    if (block.svgWidth > block.blockWidth + 1) failures.push(`diagram ${index} overflows block width`)
    if (block.cls.includes('diagram-flow') && !block.isFlowSvg) failures.push(`flow diagram ${index} did not use flow SVG backend`)
    if (block.cls.includes('diagram-sequence') && !block.isSequenceSvg) failures.push(`sequence diagram ${index} did not use sequence SVG backend`)
    if (block.cls.includes('diagram-quadrant') && !block.isQuadrantSvg) failures.push(`quadrant diagram ${index} did not use quadrant SVG backend`)
    if (block.cls.includes('diagram-quadrant') && !block.quadrantLabelCountMatches) failures.push(`quadrant diagram ${index} has mismatched point/label counts`)
    if (block.cls.includes('diagram-quadrant') && block.quadrantLabelMaxDistance > 18) failures.push(`quadrant diagram ${index} label is detached from source point (${block.quadrantLabelMaxDistance.toFixed(1)}px)`)
    if (block.cls.includes('diagram-state') && !block.isStateSvg) failures.push(`state diagram ${index} did not use state SVG backend`)
    if (block.cls.includes('diagram-er') && !block.isERSvg) failures.push(`ER diagram ${index} did not use ER SVG backend`)
    if (block.cls.includes('diagram-tree') && !block.isTreeSvg) failures.push(`tree diagram ${index} did not use tree SVG backend`)
  }
  return failures
}

async function waitForPage(port) {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await getJson(port, '/json/list')
      const page = targets.find(target => target.type === 'page')
      if (page) return page
    } catch {
      // Chrome has not opened the debugging port yet.
    }
    await sleep(100)
  }
  throw new Error('Chrome did not expose a page target')
}

async function getJson(port, path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`)
  return response.json()
}

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  return candidates.find(candidate => existsSync(candidate))
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
