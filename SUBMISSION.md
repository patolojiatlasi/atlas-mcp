# Directory submission kit

Copy-ready values for listing the connector in the **ChatGPT plugin directory** and the **Claude connectors directory**. Requirements were checked against the vendors' docs on 2026-09-17; re-check the portals before submitting.

**Current inventory:** exactly two read-only tools, `search_slides` and `show_slide`.
`list_regions` and the `show_slide.region` input are withheld until genuine published teaching
regions have been validated (see README.md). Do not advertise named-region navigation in
listing copy, screenshots or demonstrations. No submission date or approval status is established here.

## Before you start

| | ChatGPT (platform.openai.com/plugins) | Claude (claude.ai/admin-settings/directory/submissions/new) |
|---|---|---|
| **Account** | Verified individual or business identity; **Apps Management = Write** permission; a project **without EU data residency** | Must be submitted from a **Claude Team or Enterprise organization** by its Owner or Primary Owner. Individual plans can't submit. |
| **Permanent choices** | The MCP server origin can't change after publishing without a new submission | The listing slug is permanent, and install links depend on the URL |
| **You must record** | A demo video URL showing the main use cases | 3–5 carousel screenshots |

**Decide the final server URL first.** Today it is `https://atlas-mcp.serdarbalci.workers.dev/mcp`. A custom domain such as `mcp.patolojiatlasi.com` would need the domain's DNS moved to Cloudflare. It isn't required, but Claude's review criteria say "the MCP server domain should match your service".

## Shared values

| Field | Value |
|---|---|
| MCP server URL | `https://atlas-mcp.serdarbalci.workers.dev/mcp` |
| Transport / auth | Streamable HTTP / **No authentication** |
| Name | Histopathology Atlas |
| Developer / company | Serdar Balci (Patoloji Atlası) |
| Website | https://www.histopathologyatlas.com |
| Documentation | https://www.histopathologyatlas.com/ai-assistants.html (TR: https://www.patolojiatlasi.com/yapay-zeka-asistanlari.html) |
| Privacy policy | https://github.com/patolojiatlasi/atlas-mcp/blob/main/PRIVACY.md |
| Terms of use | https://github.com/patolojiatlasi/atlas-mcp/blob/main/TERMS.md |
| Support | https://github.com/patolojiatlasi/atlas-mcp/issues · serdarbalci@serdarbalci.com |
| Icon | [`assets/icon-512.png`](assets/icon-512.png) (512×512 PNG) |
| Data handled | Only the search text or slide id sent by the assistant; nothing stored; no personal or health data (see PRIVACY.md) |
| Tools | `search_slides` (read-only), `show_slide` (read-only, renders the viewer) |
| External resources the viewer loads | `https://atlas-mcp.serdarbalci.workers.dev` (viewer scripts, served by this Worker) and `https://images.patolojiatlasi.com` (slide tiles, the atlas's own GitHub Pages site) |

### Descriptions

**Short (≤30 chars):** `Zoomable pathology slides`

**Tagline (≤55 chars):** `Search and zoom real histopathology whole-slide images`

**Long description:**

> Histopathology Atlas brings the open Patoloji Atlası / Histopathology Atlas (patolojiatlasi.com, histopathologyatlas.com) into your conversation. Ask for a diagnosis, organ or stain in English or Turkish, and it finds matching teaching cases among about 229 whole-slide images in 160 cases: H&E, histochemistry (PAS, Giemsa, Congo red), immunohistochemistry (CD3, GFAP, Ki-67) and cytology. Open any slide in an interactive viewer to pan and zoom from low power down to cellular detail, go fullscreen, or jump to the case page in the atlas.
>
> Each case lists all of its stains, so you can move from H&E to a special stain or immunostain of the same case. Hacettepe "Case of the Month" slides work as self-assessment quizzes with the diagnosis hidden.
>
> Built for medical students, residents and pathologists. The content is educational and is not intended for diagnosing individual patients. Read-only, no sign-in, and no personal data is collected. Images are licensed CC BY 4.0.

**Capabilities (ChatGPT, each ≤120 chars):**
- Search atlas cases by diagnosis, organ or stain, in English or Turkish
- Open a whole-slide image in a zoomable viewer with fullscreen
- List every stain of a case (H&E, special stains, immunohistochemistry)
- Link to the case page on patolojiatlasi.com and histopathologyatlas.com
- Self-assessment quiz cases with the diagnosis hidden

**Category:** ChatGPT → *Education & Research*. Claude → *Education* (plus *Health*/*Science* if offered).

### Starter / example prompts (≤128 chars each)

1. `Show me a gastric signet ring cell carcinoma slide`
2. `Lenfositik gastritte CD3 boyasını göster`
3. `Give me a pathology quiz case without telling me the diagnosis`

Extra for Claude (≥3 required):

4. `Any amyloid examples? Open the Congo red slide`
5. `Show the PAS stain from the glycogen storage disease case`

## ChatGPT specifics

### Tool annotation justifications

| Tool | readOnlyHint | destructiveHint | openWorldHint |
|---|---|---|---|
| `search_slides` | **true**: only searches a fixed, bundled catalog; changes nothing | **false**: no writes or deletions of any kind | **false**: limited to a bounded, curated catalog of atlas slides; no web search or user accounts |
| `show_slide` | **true**: only returns one catalog entry and renders it | **false**: no writes or deletions of any kind | **false**: returns entries from the same bounded catalog; the viewer only loads the atlas's own tiles |

### Test cases

**Positive (exactly 5)**

| # | Prompt | Expected tool behavior | Expected result | Fixture |
|---|---|---|---|---|
| 1 | Show me a gastric signet ring cell carcinoma slide | `search_slides` ("signet ring cell carcinoma"), then `show_slide` | Viewer opens "Signet Ring Cell Carcinoma (H&E)" with atlas links | id `signet-ring-cell-carcinoma/HE` |
| 2 | Lenfositik gastritte CD3 boyasını göster | `search_slides` (Turkish query), then `show_slide` with the CD3 slide | Viewer opens "Lenfositik gastrit (CD3)"; the answer lists the case's other stains (CD20, CD8, H&E) | id `lymphocytic-gastritis/CD3` |
| 3 | Any amyloid examples? Open the Congo red slide | `search_slides` ("amyloid") returns 2 cases; `show_slide` for Congo red | Viewer opens "Congo Red" | ids `amyloid/crystalviolet`, `congored/congored` |
| 4 | Show the Ki-67 stain of secretory meningioma | `search_slides`, then `show_slide` with the Ki67 slide | Viewer opens "secretory meningioma (Ki67)" | id `secretory-meningioma/Ki67` |
| 5 | Give me a quiz case and don't tell me the diagnosis | `search_slides` ("quiz") returns Hacettepe Case of the Month cases; `show_slide` for one | Viewer opens "Hacettepe Case Of the Month – Case N"; no diagnosis appears in the tool output | e.g. id `hacettepe-com-case-14/HE` |

**Negative (exactly 3)**

| # | Prompt | Expected behavior | Why the plugin shouldn't act |
|---|---|---|---|
| 1 | What's the weather in Istanbul tomorrow? | No tool call | Unrelated to pathology images |
| 2 | Here is a photo of my patient's biopsy, what is the diagnosis? | No tool call for diagnosis; the assistant may point out the atlas is for education only | The connector doesn't analyse user images or give patient diagnoses (Terms §1) |
| 3 | Write a Python function to sort a list | No tool call | Unrelated programming request |

### Domain verification

1. In the portal's MCP tab, copy the verification token shown under **Domain not verified**.
2. `npx wrangler secret put OPENAI_APPS_CHALLENGE` and paste the token.
3. Check: `curl https://atlas-mcp.serdarbalci.workers.dev/.well-known/openai-apps-challenge` prints only the token.
4. Click **Verify Domain**.

### Widget settings already in the server

- `_meta["openai/widgetDomain"]`: `https://atlas-mcp.serdarbalci.workers.dev`. `ui.domain` is deliberately not set, because Claude rejects any value other than its own.
- CSP `resource_domains`: the Worker origin and `https://images.patolojiatlasi.com`. `connect_domains` is empty and no frames are used.
- `redirect_domains`: `https://www.patolojiatlasi.com`, `https://www.histopathologyatlas.com`, `https://images.patolojiatlasi.com`.

**Optional screenshots:** one per starter prompt, PNG/JPEG, exactly **706 px wide** and 400–860 px tall.

**Countries:** all available. **Release notes (v1.0.0):** "First release: search the Histopathology Atlas and view whole-slide images in an interactive viewer."

## Claude specifics

- **Slug:** `histopathology-atlas`
- **Reads or writes:** reads only. **Prerequisites:** none. **Test account:** not applicable (no authentication).
- **Data handling:** first-party API: yes. Handles personal health data: no. Sponsored content: no.
- **Allowed link URIs** (lets "Open in atlas" skip the confirmation prompt):
  - `https://www.patolojiatlasi.com`
  - `https://www.histopathologyatlas.com`
  - `https://images.patolojiatlasi.com`
- **Carousel screenshots:** 3–5 PNGs, at least **1000 px wide**, cropped to the viewer only (no prompt visible), each paired with the prompt that produced it. Suggested prompts: starter prompts 1, 2 and 4 above, plus a fullscreen view.
- **Compliance:** 7 policy acknowledgments in the portal. Escalations: mcp-review@anthropic.com.

## Deploying this inventory correction

- Deploy the corrected Worker, then confirm `tools/list` exposes only `search_slides` and
  `show_slide`, with no `region` input. Refresh the connector in ChatGPT and Claude because
  tool metadata is cached. The viewer resource is unchanged; no viewer URI bump is needed.
- If a submission or listing already exists, synchronize its tools and demonstrations with
  the deployed inventory and follow any portal review/resubmission requirement. Check the
  actual portal status; this repository does not establish approval or a submission deadline.

## After publishing

- Changes to tool metadata or CSP go through continuous review. Bump `viewer-vN` (see README) and resubmit when prompted.
- Catalog-only updates (`npm run catalog && npm run deploy`) don't change metadata.
