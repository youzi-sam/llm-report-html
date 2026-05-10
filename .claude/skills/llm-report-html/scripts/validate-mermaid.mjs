// Validate mermaid source via mermaid's own parser, with a jsdom shim so it
// runs under node. Reads source from stdin or argv[2].
//   exit 0 → "OK"
//   exit 1 → parse error (printed to stderr)
//   exit 2 → bad invocation / empty input

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.HTMLElement = dom.window.HTMLElement;
global.SVGElement = dom.window.SVGElement;

const { default: mermaid } = await import('mermaid');

let buf = '';
if (process.argv[2]) {
  buf = process.argv[2];
} else if (!process.stdin.isTTY) {
  for await (const chunk of process.stdin) buf += chunk;
} else {
  console.error('usage: validate-mermaid.mjs "<code>"   or pipe via stdin');
  process.exit(2);
}

buf = buf.trim();
if (!buf) {
  console.error('error: empty input');
  process.exit(2);
}

try {
  await mermaid.parse(buf);
  console.log('OK');
  process.exit(0);
} catch (e) {
  console.error((e && e.message) || String(e));
  process.exit(1);
}
