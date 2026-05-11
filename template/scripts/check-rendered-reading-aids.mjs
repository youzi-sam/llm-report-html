import { withBrowserPage } from './lib/browser-smoke.mjs'

const htmlPath = process.argv[2]
if (!htmlPath) {
  console.error('usage: node template/scripts/check-rendered-reading-aids.mjs <report.html>')
  process.exit(2)
}

try {
  const smoke = await withBrowserPage(htmlPath, async ({ send, sleep }) => {
    await sleep(1200)
    const result = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const sourceLink = document.querySelector('.source-json-link')
        const keyword = document.querySelector('pre code.ch-chroma [class^="ch-k"]')
        const code = document.querySelector('pre code.ch-chroma')
        const keywordColor = keyword ? getComputedStyle(keyword).color : ''
        const codeColor = code ? getComputedStyle(code).color : ''
        return {
          tocLinks: [...document.querySelectorAll('.report-toc a')].map(a => a.textContent),
          sourceHref: sourceLink ? sourceLink.getAttribute('href') : '',
          sourceTarget: sourceLink ? sourceLink.getAttribute('target') : '',
          highlighted: !!keyword && keywordColor !== codeColor,
          keywordColor,
          codeColor,
          errors: [...document.querySelectorAll('.report-error')].map(node => node.textContent),
        }
      })()`,
    })
    return result.result.value
  }, { portBase: 9800 })

  const failures = []
  if (smoke.errors.length > 0) failures.push(`report errors: ${smoke.errors.join(' | ')}`)
  if (smoke.tocLinks.length < 3) failures.push(`expected TOC links, got ${smoke.tocLinks.length}`)
  if (!smoke.tocLinks.includes('Overview') || !smoke.tocLinks.includes('Implementation')) failures.push('TOC links missing expected headings')
  if (!smoke.sourceHref.endsWith('.json') || smoke.sourceTarget !== '_blank') failures.push(`source JSON link invalid (href=${smoke.sourceHref || 'missing'}, target=${smoke.sourceTarget || 'missing'})`)
  if (!smoke.highlighted) failures.push(`code block did not apply Chroma token colors (keyword=${smoke.keywordColor || 'missing'}, code=${smoke.codeColor || 'missing'})`)
  if (failures.length > 0) {
    console.error(`rendered reading-aids smoke failed: ${htmlPath}`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }
  console.log(`rendered-reading-aids-check ok (${smoke.tocLinks.length} toc links)`)
} catch (error) {
  console.error(error.message)
  process.exit(2)
}
