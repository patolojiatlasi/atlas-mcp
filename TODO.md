# TODO: atlas-mcp V1

Goal: search the atlas and open a slide in a zoomable viewer inside ChatGPT and Claude, using one MCP Apps server on Cloudflare Workers.

## Acceptance criteria
- [x] The catalog holds only slides whose DZI tiles exist and that appear in the book (or are published).
- [x] Search works in EN and TR. Quiz diagnoses are searchable but never returned.
- [x] `show_slide` returns text with the atlas links (fallback) plus `structuredContent` for the viewer.
- [x] The viewer renders under a strict CSP in a sandboxed iframe: tiles load, fullscreen and open-link requests reach the host, and the failure state shows when tiles fail.
- [x] Deployed: https://atlas-mcp.serdarbalci.workers.dev/mcp
- [ ] The viewer renders in the real hosts (matrix below).

## Checklist
- [x] Scaffold (pinned: @modelcontextprotocol/server 2.0.0, ext-apps 2.0.0, zod 4.6.5, wrangler 4.133.0)
- [x] `scripts/build-catalog.mjs`: 229 slides / 160 cases
- [x] `src/search.js` + `test/search.test.mjs` (9 tests)
- [x] `src/worker.js`, `src/viewer.html`
- [x] Verify: `npm test`; MCP calls against `wrangler dev`; headless-Chrome sandbox harness
- [x] `npx wrangler login` (user), then `npm run deploy`
- [ ] Host matrix (user, with the deployed URL)

## Host matrix
Prompts:
1. "Show me a gastric signet ring cell carcinoma slide"
2. "Lenfositik gastritte CD3 boyasını göster"
3. "Show the PAS stain from that case" (after a BS18 or glycogen storage result)
4. "Any amyloid examples?"
5. "Give me a quiz case" (the diagnosis must not leak)

| Host | Widget renders | Tiles load | Fullscreen | Open in atlas | Notes |
|---|---|---|---|---|---|
| ChatGPT web (Chat) | | | | | |
| ChatGPT web (Work) | | | | | |
| Claude (reported by user, 2026-09-17) | ✅ | ✅ | | | first try needed a new chat after adding the connector |
| Claude Desktop | | | | | |
| Claude iOS / Android | | | | | CSP issues reported: claude-ai-mcp#40, ext-apps#734 |

## Working notes
- **Handler:** `createMcpHandler` from `@modelcontextprotocol/server` does no Origin check, so requests with `Origin: https://claude.ai` pass. Fallback if a host misbehaves: `agents@0.23.0` handler plus `nodejs_compat` and `allowedOriginHostnames`.
- **Registration:** `registerAppResource` sets the mimeType only on the listing. The contents item sets `mimeType` and `_meta.ui.csp` itself.
- **Viewer bridge:** `new App(info, {availableDisplayModes})` must not get a third argument, or autoResize turns off. Register the `toolresult` listener before `connect()`.
- **Sandbox:** in the sandboxed iframe (`Origin: null`), jsDelivr and GitHub Pages both answer `ACAO *`. SRI works for the classic OSD script and, through the importmap, for the ES module.
- **Stain labels:** only slide numbering is stripped (`HE1` → H&E, `MGG-1` → MGG); antibody digits stay (CD3, Ki67).
- **Legacy slides:** the 5 `viewer_z0` slides have no L0–L1 tiles, which causes one harmless 404 in the console.

## Results
- `npm run catalog`: included 229 slides / 160 cases. Dropped: 56 not in book/unpublished, 9 with no DZI. The ones shown in the book are the `all`/`curtain`/`sidebyside` layouts, `metaplasia/HE_annotated*`, and dead `cholesteatoma/HE`, `kidneyoncocytoma/HE`, `hacettepe-com-case-4/HE`.
- `wrangler dev` checks: initialize and tools/list (both resourceUri keys, 3 hints); search_slides; show_slide by id, lowercase id, URL, and bad id (with suggestions); resources/list and read (mcp-app mimeType plus CSP).
- Independent review workflow (3 reviewers, each finding checked by a skeptic): 4 medium issues confirmed and fixed with regression tests (see CHANGELOG.md); 2 viewer claims rejected (no real host reaches those states). `npm test`: 9/9 after the fixes.
- `wrangler deploy --dry-run`: 1427 KiB / 230 KiB gzip.
- Headless Chrome harness (sandbox `allow-scripts`, spec default CSP plus declared domains): CD3 slide 29 tiles, 0 errors; TR locale; fullscreen and open-link reached the host; jp2k-mislabelled exostosis/oc001 renders; legacy viewer_z0 renders; broken tile URL shows the failure overlay.

## Publishing
- [x] PRIVACY.md, TERMS.md, LICENSE (MIT code / CC BY 4.0 content), public README
- [x] Directory-ready server: `openai/widgetDomain` (no `ui.domain`), `openai/widgetCSP` redirect domains, OpenAI challenge route, self-hosted viewer scripts (no third-party CDN), descriptive tool texts, `viewer-v2`
- [x] SUBMISSION.md (listing copy, 5+3 test cases, annotation justifications), icon 512×512
- [ ] User: ChatGPT (identity verification, demo video, challenge token), Claude (Team/Enterprise org, carousel screenshots)
- [ ] Re-test viewer-v2 in Claude and ChatGPT after deploy

## Later (with trigger)
- Scheduled catalog refresh with a GitHub Action, once manual refresh feels stale. Use a non-cone sparse checkout of `/lists/list.yaml`, `/docs/*.html`, `/EN/*.html`, run daily at 03:00 UTC, and commit only the catalog.
- Custom domain `mcp.patolojiatlasi.com`, before sharing widely (it changes the connector URL).
- Compare/synced viewers, annotations, a real scale bar (MPP from `vips-properties.xml`), thumbnails.
- Directory submission: `ui.domain` per host, privacy policy, test cases.
