import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import catalog from "../data/catalog.json" with { type: "json" };
import viewerHtml from "./viewer.html";
import { buildIndex, searchSlides, findSlide } from "./search.js";

// Bump the version whenever viewer.html changes: ChatGPT and Claude cache the resource by URI.
const VIEWER_URI = "ui://atlas/viewer-v1.html";
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const DISCLAIMER = "Educational reference images; not for diagnosing individual patients. Never include patient identifiers.";
const index = buildIndex(catalog); // module scope: built once per isolate, not per request

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
        "Returns cases with their slide ids and atlas links; call this before show_slide. " + DISCLAIMER,
      inputSchema: z.object({
        query: z.string().min(1).describe("Diagnosis, organ and/or stain, e.g. 'signet ring cell carcinoma', 'lenfositik gastrit CD3'"),
      }),
      annotations: READ_ONLY,
    },
    async ({ query }) => ({ content: text(searchSlides(index, query)) }),
  );

  registerAppTool(
    server,
    "show_slide",
    {
      title: "Show slide",
      description:
        "Open one whole-slide image from the atlas in an interactive zoomable viewer. " +
        "The id must come from search_slides results (an atlas slide viewer URL or atlas section link also works). " + DISCLAIMER,
      inputSchema: z.object({ id: z.string().min(1).describe("Slide id from search_slides, e.g. 'lymphocytic-gastritis/CD3'") }),
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
      const { tileSource, terms, ...info } = slide; // terms may hold a quiz diagnosis: never return it
      const lines = [
        `${info.title_en} / ${info.title_tr}${info.stain ? ` (${info.stain})` : ""}`,
        info.quiz && "Quiz case: the diagnosis is hidden. Do not guess or reveal it unless the user asks.",
        info.atlas_url_en && `Histopathology Atlas: ${info.atlas_url_en}`,
        info.atlas_url_tr && `Patoloji Atlası: ${info.atlas_url_tr}`,
        `Full-screen viewer: ${info.viewer_url}`,
      ];
      return { content: text(lines.filter(Boolean).join("\n")), structuredContent: { ...info, tileSource } };
    },
  );

  registerAppResource(server, "Slide viewer", VIEWER_URI, { description: "Zoomable whole-slide image viewer" }, async () => ({
    contents: [
      {
        uri: VIEWER_URI,
        mimeType: RESOURCE_MIME_TYPE, // the helper sets it on the listing only; hosts read the contents item
        text: viewerHtml,
        _meta: {
          ui: {
            csp: { resourceDomains: ["https://cdn.jsdelivr.net", "https://images.patolojiatlasi.com"] },
            prefersBorder: true,
          },
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
    if (new URL(request.url).pathname.replace(/\/+$/, "") !== "/mcp") {
      return new Response("Histopathology Atlas MCP server. Connect to /mcp", { status: 404 });
    }
    await logRequest(request);
    return handler.fetch(request);
  },
};
