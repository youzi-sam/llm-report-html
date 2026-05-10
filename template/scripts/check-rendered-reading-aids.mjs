import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const htmlPath = process.argv[2]
if (!htmlPath) {
  console.error('usage: node template/scripts/check-rendered-reading-aids.mjs <report.html>')
  process.exit(2)
}

const chrome = process.env.CHROME_BIN || findChrome()
if (!chrome) {
  console.error('Chrome is required for rendered reading-aids smoke. Set CHROME_BIN=/path/to/chrome.')
  process.exit(2)
}

const port = 9800 + Math.floor(Math.random() * 400)
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
  await sleep(1200)
  const result = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const source = document.querySelector('#source-json-control')
      source.open = true
      source.dispatchEvent(new Event('toggle'))
      return {
        tocLinks: [...document.querySelectorAll('.report-toc a')].map(a => a.textContent),
        sourceText: source.querySelector('pre').textContent,
        highlighted: !!document.querySelector('pre code.chroma [class^="ch-"]'),
        errors: [...document.querySelectorAll('.report-error')].map(node => node.textContent),
      }
    })()`,
  })
  const smoke = result.result.value
  const failures = []
  if (smoke.errors.length > 0) failures.push(`report errors: ${smoke.errors.join(' | ')}`)
  if (smoke.tocLinks.length < 3) failures.push(`expected TOC links, got ${smoke.tocLinks.length}`)
  if (!smoke.tocLinks.includes('Overview') || !smoke.tocLinks.includes('Implementation')) failures.push('TOC links missing expected headings')
  if (!smoke.sourceText.includes('"sections"') || !smoke.sourceText.includes('"Reading Aids Smoke"')) failures.push('source JSON control did not expose source data')
  if (!smoke.highlighted) failures.push('code block did not render highlighted token classes')
  if (failures.length > 0) {
    console.error(`rendered reading-aids smoke failed: ${htmlPath}`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }
  console.log(`rendered-reading-aids-check ok (${smoke.tocLinks.length} toc links)`)

  try {
    await send('Browser.close')
  } catch {}
  ws.close()
} finally {
  await sleep(200)
  if (!proc.killed) proc.kill()
  rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}

async function waitForPage(port) {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await getJson(port, '/json/list')
      const page = targets.find(target => target.type === 'page')
      if (page) return page
    } catch {}
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
