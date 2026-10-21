import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { z } from 'zod';
import catalog from '../data/catalog.json' with { type: 'json' };
import { buildIndex, searchSlides, findSlide, publicSlide } from '../src/search.js';

// Exercise the Worker's registration and callbacks without Cloudflare's runtime or network.
// Only platform/SDK wiring is substituted; schemas and search/projection functions are real.
function registeredTools(slides = catalog.slides) {
  const tools = new Map();
  const source = readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export default {', 'const worker = {');
  const register = (name, config, callback) => tools.set(name, { config, callback });
  vm.runInNewContext(source, {
    env: { PUBLIC_ORIGIN: 'https://example.test' },
    McpServer: class { registerTool(...args) { register(...args); } },
    createMcpHandler: factory => { factory(); return {}; },
    registerAppTool: (_server, ...args) => register(...args),
    registerAppResource: () => {}, RESOURCE_MIME_TYPE: 'text/html',
    z, catalog: { slides }, viewerHtml: '', buildIndex, searchSlides, findSlide, publicSlide,
  });
  return tools;
}

const tools = registeredTools();
test('registered inventory and directory tool tables agree', () => {
  const names = [...tools.keys()].sort();
  assert.deepEqual(names, ['search_slides', 'show_slide']);
  for (const filename of ['README.md', 'SUBMISSION.md']) {
    const doc = readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8');
    const section = filename === 'README.md'
      ? doc.split('## What you get')[1].split('## Support')[0]
      : doc.split('### Tool annotation justifications')[1].split('### Test cases')[0];
    const documentedTools = [...new Set([...section.matchAll(/^\| `([^`]+)` \|/gm)].map(m => m[1]))].sort();
    assert.deepEqual(documentedTools, names, filename);
    assert.match(doc, /`list_regions`/);
    assert.match(doc, /withheld/);
  }
  for (const { config } of tools.values()) {
    assert.equal(config.annotations.readOnlyHint, true);
    assert.equal(config.annotations.destructiveHint, false);
    assert.equal(config.annotations.openWorldHint, false);
    assert.doesNotMatch(config.description, /list_regions|named region/i);
  }
  assert.deepEqual(Object.keys(tools.get('show_slide').config.inputSchema.shape), ['id']);
});

test('show_slide opens a slide without regions and ignores an obsolete region input', async () => {
  const tool = tools.get('show_slide');
  const id = catalog.slides[0].id;
  const input = tool.config.inputSchema.parse({ id, region: 'obsolete' });
  assert.deepEqual(input, { id });
  const result = await tool.callback(input);
  assert.deepEqual(result.structuredContent.regions, []);
  assert.equal(result.structuredContent.region, undefined);
  assert.equal(result.structuredContent.terms, undefined);
  assert.doesNotMatch(result.content[0].text, /list_regions|zoomed to|obsolete/);
});

test('show_slide preserves authored-region data but withholds quiz labels, notes and metadata', async () => {
  // Synthetic only: no test coordinates or diagnostic labels enter data/catalog.json.
  const region = { id: 'test-region', label_en: 'SYNTHETIC ANSWER', x: 1, y: 2, width: 3, height: 4,
    note_en: 'SYNTHETIC ANSWER', metadata: { diagnosis: 'SYNTHETIC ANSWER' } };
  const slide = { ...catalog.slides[0], regions: [region], terms: 'SYNTHETIC ANSWER' };
  for (const quiz of [false, true]) {
    const tool = registeredTools([{ ...slide, quiz }]).get('show_slide');
    const result = await tool.callback({ id: slide.id });
    assert.deepEqual(result.structuredContent.regions, quiz ? [] : [region]);
    assert.equal(result.structuredContent.terms, undefined);
    if (quiz) assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC ANSWER/);
  }
});
