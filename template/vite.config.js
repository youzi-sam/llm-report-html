import { viteSingleFile } from 'vite-plugin-singlefile'

export default {
  plugins: [viteSingleFile()],
  base: './',
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
}
