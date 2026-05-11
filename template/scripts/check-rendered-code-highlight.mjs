import { withBrowserPage } from './lib/browser-smoke.mjs'

const htmlPath = process.argv[2]
if (!htmlPath) {
  console.error('usage: node template/scripts/check-rendered-code-highlight.mjs <report.html>')
  process.exit(2)
}

try {
  const smoke = await withBrowserPage(htmlPath, async ({ send, sleep }) => {
    await sleep(1200)
    const result = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const codeBlocks = [...document.querySelectorAll('pre code.ch-chroma')]
        const highlighted = codeBlocks.map(code => {
          const token = code.querySelector('[class^="ch-"]:not(.ch-line)')
          const tokenColor = token ? getComputedStyle(token).color : ''
          const codeColor = getComputedStyle(code).color
          const codeBackground = getComputedStyle(code).backgroundColor
          return {
            tokenColor,
            codeColor,
            codeBackground,
            applied: !!token && tokenColor !== codeColor,
            transparentBackground: codeBackground === 'rgba(0, 0, 0, 0)',
          }
        })
        return {
          codeBlockCount: codeBlocks.length,
          highlightedCount: highlighted.filter(item => item.applied).length,
          transparentBackgroundCount: highlighted.filter(item => item.transparentBackground).length,
          highlighted,
          errors: [...document.querySelectorAll('.report-error')].map(node => node.textContent),
        }
      })()`,
    })
    return result.result.value
  }, { portBase: 9900 })

  const failures = []
  if (smoke.errors.length > 0) failures.push(`report errors: ${smoke.errors.join(' | ')}`)
  if (smoke.codeBlockCount === 0) failures.push('no code blocks rendered')
  if (smoke.highlightedCount !== smoke.codeBlockCount) {
    failures.push(`highlighted ${smoke.highlightedCount}/${smoke.codeBlockCount} code blocks`)
  }
  if (smoke.transparentBackgroundCount !== smoke.codeBlockCount) {
    failures.push(`transparent code backgrounds ${smoke.transparentBackgroundCount}/${smoke.codeBlockCount}`)
  }
  if (failures.length > 0) {
    console.error(`rendered code-highlight smoke failed: ${htmlPath}`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }
  console.log(`rendered-code-highlight-check ok (${smoke.codeBlockCount} code blocks)`)
} catch (error) {
  console.error(error.message)
  process.exit(2)
}
