import { withBrowserPage } from './lib/browser-smoke.mjs'
import { readFileSync, statSync } from 'node:fs'

const htmlPath = process.argv[2]
if (!htmlPath) {
  console.error('usage: node template/scripts/check-rendered-math.mjs <report.html>')
  process.exit(2)
}

try {
  const html = readFileSync(htmlPath, 'utf8')
  const size = statSync(htmlPath).size
  const smoke = await withBrowserPage(htmlPath, async ({ send, sleep }) => {
    await sleep(1200)
    const result = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const math = [...document.querySelectorAll('math')]
        const display = [...document.querySelectorAll('.math-block math[display="block"]')]
        const styleText = [...document.querySelectorAll('style')].map(node => node.textContent || '').join('\\n')
        const paragraphText = document.body.textContent || ''
        return {
          mathCount: math.length,
          displayCount: display.length,
          hasKaTeXFontCSS: styleText.includes('KaTeX_Main') || styleText.includes('@font-face'),
          hasKaTeXHTMLLayer: !!document.querySelector('.katex-html, .katex-mathml'),
          keepsDollarText: paragraphText.includes('$100'),
          errors: [...document.querySelectorAll('.report-error')].map(node => node.textContent),
        }
      })()`,
    })
    return result.result.value
  }, { portBase: 9950 })

  const failures = []
  if (size > 100000) failures.push(`math smoke HTML should stay below 100KB, got ${size}`)
  if (html.includes('data:font') || html.includes('KaTeX_Main') || html.includes('@font-face')) {
    failures.push('HTML must not inline KaTeX fonts')
  }
  if (smoke.errors.length > 0) failures.push(`report errors: ${smoke.errors.join(' | ')}`)
  if (smoke.mathCount < 5) failures.push(`expected at least 5 native MathML nodes, got ${smoke.mathCount}`)
  if (smoke.displayCount !== 2) failures.push(`expected 2 display formulas, got ${smoke.displayCount}`)
  if (smoke.hasKaTeXFontCSS) failures.push('KaTeX font CSS must not be inlined')
  if (smoke.hasKaTeXHTMLLayer) failures.push('KaTeX HTML layout layer must not be rendered')
  if (!smoke.keepsDollarText) failures.push('plain dollar text was not preserved')
  if (failures.length > 0) {
    console.error(`rendered math smoke failed: ${htmlPath}`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }
  console.log(`rendered-math-check ok (${smoke.mathCount} formulas)`)
} catch (error) {
  console.error(error.message)
  process.exit(2)
}
