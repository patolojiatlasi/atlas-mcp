# Histopathology Atlas for ChatGPT & Claude

Search the [Patoloji Atlası](https://www.patolojiatlasi.com) / [Histopathology Atlas](https://www.histopathologyatlas.com) from inside your AI assistant and zoom into real whole-slide images without leaving the chat.

> *"Show me a gastric signet ring cell carcinoma slide"* · *"Lenfositik gastritte CD3 boyasını göster"* · *"Give me a quiz case"*

- About **229 whole-slide images in 160 cases**: H&E, histochemistry (PAS, Giemsa, Congo red…), immunohistochemistry (CD3, GFAP, Ki-67…) and cytology.
- Ask in **English or Turkish**. Each answer links to the case's section on both atlas sites.
- **Quiz mode:** Hacettepe *Case of the Month* slides keep their diagnosis hidden.
- Read-only, no sign-in, no cookies, no tracking.

**Educational use only.** Not for diagnosing individual patients, and please never type patient identifiers. See the [Terms of Use](TERMS.md) and [Privacy Policy](PRIVACY.md).

## Connect

Server URL:

```text
https://atlas-mcp.serdarbalci.workers.dev/mcp
```

No authentication is needed.

| App | Requirements | Steps |
|---|---|---|
| **Claude** (web, desktop, mobile) | Any plan (Free allows one custom connector) | **Customize → Connectors → + → Add custom connector**, paste the URL. In a chat, enable it from the **+ / connectors** menu. |
| **ChatGPT** (web) | Plus, Pro, Business, Enterprise or Edu | **Settings → Security and login → Developer mode** on, then **chatgpt.com/plugins → +**, paste the URL, choose *No authentication*. Pick it from the composer's tools menu. |
| **Codex, VS Code (Copilot), Cursor, other MCP clients** | — | Add a remote (Streamable HTTP) MCP server with the URL. These apps show text answers with atlas links, not the zoomable viewer. |

### Türkçe

Sunucu adresi: `https://atlas-mcp.serdarbalci.workers.dev/mcp` (giriş gerekmez).

- **Claude:** Customize → Connectors → + → Add custom connector → adresi yapıştırın. Sohbette bağlayıcıyı + menüsünden açın.
- **ChatGPT (web):** Ayarlar → Security and login → Developer mode'u açın, ardından chatgpt.com/plugins → + → adresi yapıştırın, *No authentication* seçin.
- Örnek sorular: *"Amiloid örneklerini göster"*, *"Helicobacter pylori Giemsa kesitini aç"*, *"Bana bir quiz olgusu ver"*.

Yalnızca eğitim amaçlıdır; hasta tanısı için kullanmayın ve hasta kimlik bilgisi yazmayın.

## What you get

| Tool | What it does |
|---|---|
| `search_slides` | Finds cases by diagnosis, organ or stain. Returns every stain for a case plus links to the English and Turkish atlas pages. |
| `show_slide` | Opens a slide in a zoomable OpenSeadragon viewer inside the chat, with fullscreen and "Open in atlas" buttons. The text reply also contains the links, so it stays useful in apps that can't show the viewer. |

Both tools are read-only. The viewer is built on the open [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) standard, so one server works in ChatGPT and Claude.

## Support

- Bugs, wrong slide titles, missing cases: [open an issue](https://github.com/patolojiatlasi/atlas-mcp/issues).
- About the atlas content: [patolojiatlasi.github.io issues](https://github.com/patolojiatlasi/patolojiatlasi.github.io/issues).
- Email: serdarbalci@serdarbalci.com

## Licence

- Code: [MIT](LICENSE).
- Atlas images and case text (including `data/catalog.json`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit *Patoloji Atlası / Histopathology Atlas (patolojiatlasi.com)*.

---

## Development

```text
ChatGPT / Claude ──MCP──► Cloudflare Worker /mcp ── data/catalog.json (bundled)
viewer iframe ── OpenSeadragon + MCP Apps bridge (same Worker, /vendor) ── tiles (images.patolojiatlasi.com)
```

| File | Role |
|---|---|
| `scripts/build-catalog.mjs` | Builds `data/catalog.json` from the atlas repo: `lists/list.yaml` plus the rendered book (`docs/*.html` TR, `EN/*.html` EN). It checks every slide's DZI and one tile, and keeps a slide only if it is in the book (or published) and its tiles exist. |
| `src/search.js` | Keyword search: Turkish-aware folding (ı/ş/ğ…, H&E, Ki-67), stopwords, top-tier ranking. |
| `src/worker.js` | MCP server: 2 tools and the viewer resource with its Content Security Policy. |
| `src/viewer.html` | Viewer widget: MCP Apps `App` bridge plus OpenSeadragon. `%ORIGIN%` is replaced by the Worker's public origin. |
| `public/vendor/`, `scripts/vendor.mjs` | Self-hosted viewer scripts (pinned versions, SRI-checked), served as Worker static assets so the viewer loads nothing from third-party domains. |
| `SUBMISSION.md`, `assets/icon-512.png` | Copy-ready ChatGPT and Claude directory listing values, test cases and icon. |
| `test/search.test.mjs` | Search and catalog checks (`node --test`). |

```bash
npm install
npm run catalog        # rebuild data/catalog.json (ATLAS_DIR defaults to ../patolojiatlasi.github.io)
npm test
npm run dev            # http://localhost:8787/mcp (viewer scripts from localhost); inspect with: npx @modelcontextprotocol/inspector
npx wrangler login     # once
npm run deploy
npx wrangler tail      # live request log: request type and tool name only
```

**After new atlas cases:** pull the atlas repo once its CI has finished, then run `npm run catalog && npm test && npm run deploy` and commit `data/catalog.json`.
- `npm run catalog` drops a slide only on a real 404 and fails on network errors.
- It refuses to write if the slide count falls more than 5% (`-- --force` overrides).

**Gotchas**
- **Host caching:** ChatGPT and Claude cache tool and resource metadata. After changing `viewer.html`, bump `viewer-vN` in `src/worker.js` and refresh the connector.
- **CSP:** every domain the viewer loads from must be listed in `resourceDomains` and `openai/widgetCSP` (`src/worker.js`), or hosts block it. Directory reviewers check that the list matches what the viewer actually loads.
- **Upgrading OpenSeadragon or ext-apps:** `npm install` the new version, run `npm run vendor`, paste the printed SRI hashes and file names into `viewer.html`, and bump `viewer-vN`. `npm test` fails if a hash doesn't match.
- **`ui.domain`:** don't set it. Claude only accepts its own hash value there. ChatGPT reads `openai/widgetDomain` instead.
- **OpenAI domain verification:** `npx wrangler secret put OPENAI_APPS_CHALLENGE` serves the token at `/.well-known/openai-apps-challenge`.
- **Tile host:** `images.patolojiatlasi.com` (GitHub Pages) rejects CORS preflights, so the viewer must keep making plain GETs.
- **Quiz cases:** diagnoses sit in the search-only `terms` field. `show_slide` and search results never return that field.

Directory listing: [SUBMISSION.md](SUBMISSION.md). Build notes and lessons learned: [TODO.md](TODO.md), [CHANGELOG.md](CHANGELOG.md).
