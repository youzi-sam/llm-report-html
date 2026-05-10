export function createDiagramPalette(root = document.documentElement) {
  const cssVars = getComputedStyle(root)
  const cssVar = (name, fallback) => cssVars.getPropertyValue(name).trim() || fallback
  return {
    canvas: cssVar('--diagram-canvas', '#f6f6f3'),
    surface: cssVar('--diagram-surface', '#ffffff'),
    surfaceSoft: cssVar('--diagram-surface-soft', '#f1f1ee'),
    ink: cssVar('--diagram-ink', '#111111'),
    border: cssVar('--diagram-border', '#c7c7c2'),
    borderStrong: cssVar('--diagram-border-strong', '#8f8f89'),
    rootFill: cssVar('--diagram-root-fill', '#202020'),
    rootStroke: cssVar('--diagram-root-stroke', '#202020'),
    rootText: cssVar('--diagram-root-text', '#ffffff'),
    accentFill: cssVar('--diagram-accent-fill', '#eef4ff'),
    accentStroke: cssVar('--diagram-accent-stroke', '#7d9fcb'),
    accentText: cssVar('--diagram-accent-text', '#142033'),
    successFill: cssVar('--diagram-success-fill', '#eef7ef'),
    successStroke: cssVar('--diagram-success-stroke', '#86aa86'),
    successText: cssVar('--diagram-success-text', '#172817'),
    line: cssVar('--diagram-line', '#777775'),
    fontSize: cssVar('--diagram-font-size', '13px'),
  }
}
