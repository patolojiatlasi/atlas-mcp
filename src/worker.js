import { env } from "cloudflare:workers";
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import catalog from "../data/catalog.json" with { type: "json" };
import viewerHtml from "./viewer.html";
import { buildIndex, searchSlides, findSlide, publicSlide } from "./search.js";

// Bump the version whenever viewer.html changes: ChatGPT and Claude cache the resource by URI.
const VIEWER_URI = "ui://atlas/viewer-v3.html";
// Public origin of this Worker: serves the viewer's scripts (public/vendor) and is the ChatGPT widget domain.
const ORIGIN = env.PUBLIC_ORIGIN;
const TILE_HOST = "https://images.patolojiatlasi.com";
const ATLAS_SITES = ["https://www.patolojiatlasi.com", "https://www.histopathologyatlas.com"];
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const DISCLAIMER = "Content is for medical education, not for diagnosing individual patients.";
const index = buildIndex(catalog); // module scope: built once per isolate, not per request
const viewer = viewerHtml.replaceAll("%ORIGIN%", ORIGIN);

const text = (value) => [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }];

function createServer() {
  const server = new McpServer({ name: "histopathology-atlas", version: "1.0.0" });

  server.registerTool(
    "search_slides",
    {
      title: "Search histopathology atlas",
      description:
        "Search the Patoloji Atlası / Histopathology Atlas (patolojiatlasi.com, histopathologyatlas.com) for whole-slide images " +
        "by diagnosis, organ, or stain (H&E, PAS, Giemsa, immunohistochemistry such as CD3 or GFAP). Query in English or Turkish. " +
        "Returns matching cases with every stain's slide id (the input for show_slide) and links to the case pages. " + DISCLAIMER,
      inputSchema: z.object({
        query: z.string().min(1).describe("Diagnosis, organ and/or stain, e.g. 'signet ring cell carcinoma', 'lenfositik gastrit CD3'"),
      }),
      annotations: READ_ONLY,
    },
    async ({ query }) => ({ content: text(searchSlides(index, query)) }),
  );

  // Region navigation is withheld until verified teaching-region sidecars are published.
  // See README.md before restoring list_regions or show_slide.region.

  registerAppTool(
    server,
    "show_slide",
    {
      title: "Show slide",
      description:
        "Open one whole-slide image from the atlas in an interactive zoomable viewer. " +
        "Takes a slide id from search_slides results; an atlas slide viewer URL or atlas case link is also accepted. " + DISCLAIMER,
      inputSchema: z.object({
        id: z.string().min(1).describe("Slide id from search_slides, e.g. 'lymphocytic-gastritis/CD3'"),
      }),
      annotations: READ_ONLY,
      _meta: {
        ui: { resourceUri: VIEWER_URI },
        "openai/toolInvocation/invoking": "Opening slide…",
        "openai/toolInvocation/invoked": "Slide opened",
      },
    },
    async ({ id }) => {
      const slide = findSlide(index, id);
      if (!slide) {
        const words = id.replace(/^https?:\/\/[^/]+\//i, "").replace(/\.html\b|#sec-|[/_-]/gi, " ");
        const suggestions = searchSlides(index, words, 5);
        return {
          isError: true,
          content: text({ error: `Unknown slide id "${id}". Use an id from search_slides.`, suggestions: suggestions.no_match ? [] : suggestions.cases }),
        };
      }
      // publicSlide() strips `terms` and quiz-filters `regions`: never spread the raw catalog record (see search.js).
      const info = publicSlide(slide);
      const lines = [
        `${info.title_en} / ${info.title_tr}${info.stain ? ` (${info.stain})` : ""}`,
        info.quiz && "Self-assessment quiz case: the diagnosis is intentionally not included.",
        info.atlas_url_en && `Histopathology Atlas: ${info.atlas_url_en}`,
        info.atlas_url_tr && `Patoloji Atlası: ${info.atlas_url_tr}`,
        `Full-screen viewer: ${info.viewer_url}`,
      ];
      return {
        content: text(lines.filter(Boolean).join("\n")),
        structuredContent: info,
      };
    },
  );

  registerAppResource(server, "Slide viewer", VIEWER_URI, { description: "Zoomable whole-slide image viewer" }, async () => ({
    contents: [
      {
        uri: VIEWER_URI,
        mimeType: RESOURCE_MIME_TYPE, // the helper sets it on the listing only; hosts read the contents item
        text: viewer,
        _meta: {
          // No ui.domain: Claude only accepts its own {hash}.claudemcpcontent.com value there.
          ui: { csp: { resourceDomains: [ORIGIN, TILE_HOST] }, prefersBorder: true },
          // ChatGPT-only aliases (ignored by other hosts): directory submission needs a widget domain,
          // and redirect_domains lets "Open in atlas" links through.
          "openai/widgetDomain": ORIGIN,
          "openai/widgetCSP": { connect_domains: [], resource_domains: [ORIGIN, TILE_HOST], redirect_domains: [...ATLAS_SITES, TILE_HOST] },
        },
      },
    ],
  }));

  return server;
}

const handler = createMcpHandler(createServer);

// Logs only the JSON-RPC method, tool/resource name and client info (never arguments), visible via `wrangler tail`.
async function logRequest(request) {
  if (request.method !== "POST") return console.log(request.method);
  const body = await request.clone().json().catch(() => null);
  for (const m of [body].flat().filter(Boolean)) {
    const p = m.params ?? {};
    console.log(JSON.stringify({
      method: m.method ?? "response",
      name: p.name ?? p.uri,
      version: request.headers.get("mcp-protocol-version"),
      ...(m.method === "initialize" && { client: p.clientInfo, extensions: p.capabilities?.extensions }),
      ...(p._meta?.["io.modelcontextprotocol/clientInfo"] && { client: p._meta["io.modelcontextprotocol/clientInfo"], extensions: p._meta["io.modelcontextprotocol/clientCapabilities"]?.extensions }),
    }));
  }
}

export default {
  fetch: async (request) => {
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    // OpenAI plugin domain verification: the token comes from platform.openai.com (wrangler secret put OPENAI_APPS_CHALLENGE).
    if (path === "/.well-known/openai-apps-challenge" && env.OPENAI_APPS_CHALLENGE) {
      return new Response(env.OPENAI_APPS_CHALLENGE, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (path !== "/mcp") {
      return new Response("Histopathology Atlas MCP server. Connect to /mcp", { status: 404 });
    }
    await logRequest(request);
    return handler.fetch(request);
  },
};
