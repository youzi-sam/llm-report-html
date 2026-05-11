import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

export async function withBrowserPage(htmlPath, fn, options = {}) {
  const chrome = process.env.CHROME_BIN || findChrome()
  if (!chrome) {
    throw new Error('Chrome is required for rendered smoke. Set CHROME_BIN=/path/to/chrome.')
  }

  const portBase = options.portBase || 9400
  const port = portBase + Math.floor(Math.random() * 400)
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

  let ws
  try {
    const page = await waitForPage(port)
    ws = new WebSocket(page.webSocketDebuggerUrl)
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
    const result = await fn({ send, sleep })
    try {
      await send('Browser.close')
    } catch {}
    return result
  } finally {
    if (ws) ws.close()
    await sleep(200)
    if (!proc.killed) proc.kill()
    rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
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
