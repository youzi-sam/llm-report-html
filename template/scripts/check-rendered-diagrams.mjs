import { withBrowserPage } from './lib/browser-smoke.mjs'

const htmlPath = process.argv[2]
if (!htmlPath) {
  console.error('usage: node template/scripts/check-rendered-diagrams.mjs <report.html>')
  process.exit(2)
}

try {
  const smoke = await withBrowserPage(htmlPath, async ({ send, sleep }) => {
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
              labelBackgroundCount: block.querySelectorAll('.labelBackground').length,
              erHeaderRectCount: block.querySelectorAll('rect.er-svg-entity-header').length,
              erHeaderPathCount: block.querySelectorAll('path.er-svg-entity-header').length,
              erEntityCount: block.querySelectorAll('.er-svg-entity').length,
              erColumnDividerCount: block.querySelectorAll('.er-svg-column-divider').length,
              erAttributeTypeCount: block.querySelectorAll('.er-svg-attribute-type').length,
              erAttributeNameCount: block.querySelectorAll('.er-svg-attribute-name').length,
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
    return result.result.value
  })

  const failures = renderedDiagramFailures(smoke)
  if (failures.length > 0) {
    console.error(`rendered diagram smoke failed: ${htmlPath}`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }
  console.log(`rendered-diagram-check ok (${smoke.blocks.length} diagrams)`)
} catch (error) {
  console.error(error.message)
  process.exit(2)
}

function renderedDiagramFailures(smoke) {
  const failures = []
  if (smoke.errors.length > 0) failures.push(`report errors: ${smoke.errors.join(' | ')}`)
  if (smoke.blocks.length === 0) failures.push('no diagram blocks rendered')
  for (const [index, block] of smoke.blocks.entries()) {
    if (!block.hasSvg) failures.push(`diagram ${index} has no svg`)
    if (block.svgWidth <= 0 || block.svgHeight <= 0) failures.push(`diagram ${index} has empty svg geometry`)
    if (block.svgWidth > block.blockWidth + 1) failures.push(`diagram ${index} overflows block width`)
    if (block.labelBackgroundCount > 0) failures.push(`diagram ${index} renders rectangular edge-label backgrounds`)
    if (block.cls.includes('diagram-flow') && !block.isFlowSvg) failures.push(`flow diagram ${index} did not use flow SVG backend`)
    if (block.cls.includes('diagram-sequence') && !block.isSequenceSvg) failures.push(`sequence diagram ${index} did not use sequence SVG backend`)
    if (block.cls.includes('diagram-quadrant') && !block.isQuadrantSvg) failures.push(`quadrant diagram ${index} did not use quadrant SVG backend`)
    if (block.cls.includes('diagram-quadrant') && !block.quadrantLabelCountMatches) failures.push(`quadrant diagram ${index} has mismatched point/label counts`)
    if (block.cls.includes('diagram-quadrant') && block.quadrantLabelMaxDistance > 18) failures.push(`quadrant diagram ${index} label is detached from source point (${block.quadrantLabelMaxDistance.toFixed(1)}px)`)
    if (block.cls.includes('diagram-state') && !block.isStateSvg) failures.push(`state diagram ${index} did not use state SVG backend`)
    if (block.cls.includes('diagram-er') && !block.isERSvg) failures.push(`ER diagram ${index} did not use ER SVG backend`)
    if (block.cls.includes('diagram-er') && block.erHeaderRectCount > 0) failures.push(`ER diagram ${index} renders rect headers`)
    if (block.cls.includes('diagram-er') && block.erHeaderPathCount !== block.erEntityCount) failures.push(`ER diagram ${index} header/entity mismatch`)
    if (block.cls.includes('diagram-er') && block.erColumnDividerCount !== block.erEntityCount * 2) failures.push(`ER diagram ${index} does not render table columns`)
    if (block.cls.includes('diagram-er') && block.erAttributeTypeCount !== block.erAttributeNameCount) failures.push(`ER diagram ${index} attribute type/name mismatch`)
    if (block.cls.includes('diagram-tree') && !block.isTreeSvg) failures.push(`tree diagram ${index} did not use tree SVG backend`)
  }
  return failures
}
