// Builds data/catalog.json from the atlas repo (lists/list.yaml + rendered book HTML) and live DZI probes.
// Usage: ATLAS_DIR=../patolojiatlasi.github.io node scripts/build-catalog.mjs [--force]
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const ATLAS_DIR = path.resolve(process.env.ATLAS_DIR ?? "../patolojiatlasi.github.io");
const OUT = "data/catalog.json";
const FORCE = process.argv.includes("--force");
const SITES = { tr: ["docs", "https://www.patolojiatlasi.com"], en: ["EN", "https://www.histopathologyatlas.com"] };
const VIEWER_RE = /https?:\/\/images\.patolojiatlasi\.com\/[^"'\s<>)#?]+?\.html/g;
const DIAGNOSIS_CALLOUTS = new Set(["tanı", "tanı için tıklayın", "click for diagnosis", "tip"]);
const GENERIC_CATEGORIES = new Set([
  "pathology", "atlas", "histopathology", "whole slide image", "virtual microscopy", "virtual microscope",
  "patoloji", "histopatoloji", "sanal mikroskop",
]);

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITIES[e] ?? m);
const text = (html) => decode(html.replace(/<span class="header-section-number">.*?<\/span>/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const https = (url) => url.replace(/^http:/, "https:");

// ---- book: url -> {page, anchor, heading, pageTitle, callouts} per language (first occurrence, pages sorted)
function readBook(dir) {
  const found = new Map();
  const files = fs.readdirSync(path.join(ATLAS_DIR, dir)).filter((f) => f.endsWith(".html")).sort();
  for (const file of files) {
    const html = fs.readFileSync(path.join(ATLAS_DIR, dir, file), "utf8").replace(/<!--[\s\S]*?-->/g, "");
    const main = html.match(/<main\b[\s\S]*?<\/main>/)?.[0];
    if (!main) continue;
    const pageTitle = text(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace(/^\d+\s+/, "").replace(/\s+–\s+[^–]+$/, "");
    const headings = new Map([...main.matchAll(/<h[1-6][^>]*data-anchor-id="(sec-[^"]+)"[^>]*>([\s\S]*?)<\/h[1-6]>/g)].map((m) => [m[1], text(m[2])]));
    const anchors = [...main.matchAll(/\bid="(sec-[^"]+)"/g)].map((m) => ({ id: m[1], pos: m.index }));
    for (const m of main.matchAll(VIEWER_RE)) {
      const url = https(m[0]);
      if (found.has(url) || url.includes("template")) continue;
      const i = anchors.findLastIndex((a) => a.pos < m.index);
      const anchor = anchors[i]?.id;
      const end = anchors.slice(i + 1).find((a) => a.id !== anchor)?.pos ?? main.length;
      const section = main.slice(anchors[i]?.pos ?? 0, end);
      const callouts = [...section.matchAll(/callout-title-container flex-fill">([\s\S]*?)<\/div>[\s\S]*?callout-body">([\s\S]*?)<\/div>/g)]
        .filter((c) => DIAGNOSIS_CALLOUTS.has(text(c[1].replace(/<span class="screen-reader-only">.*?<\/span>/g, "")).toLowerCase()))
        .map((c) => text(c[2]).slice(0, 200));
      found.set(url, {
        url: anchor ? `${SITES[dir === "docs" ? "tr" : "en"][1]}/${file}#${anchor}` : `${SITES[dir === "docs" ? "tr" : "en"][1]}/${file}`,
        // Chapter titles (<h1 class="title"><span id="sec-…">) carry no data-anchor-id: use the page title.
        heading: headings.get(anchor) ?? (anchor ? pageTitle : ""),
        pageTitle,
        callouts,
      });
    }
  }
  return found;
}

// ---- list.yaml: merge duplicate URLs, published entries first
function readList() {
  const entries = parse(fs.readFileSync(path.join(ATLAS_DIR, "lists/list.yaml"), "utf8"));
  const byUrl = new Map();
  for (const e of entries.filter((e) => e?.url).sort((a, b) => (b.type === "published") - (a.type === "published"))) {
    const url = https(String(e.url).trim());
    const merged = byUrl.get(url) ?? {};
    for (const [k, v] of Object.entries(e)) {
      const empty = (x) => x == null || x === "" || (Array.isArray(x) && x.length === 0);
      if (empty(merged[k]) && !empty(v)) merged[k] = v;
    }
    if (e.type === "published") merged.type = "published";
    byUrl.set(url, merged);
  }
  return byUrl;
}

// ---- probes: drop only on 404, fail on anything else
async function request(url, method) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { method, redirect: "follow" });
      if (res.ok || res.status === 404) return res;
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt >= 3) throw new Error(`${method} ${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function probe(viewerUrl) {
  const base = viewerUrl.replace(/\.html$/, "");
  for (const dzi of [`${base}.dzi`, `${path.posix.dirname(base)}/z_0.dzi`]) {
    const res = await request(dzi, "GET");
    if (res.status === 404) continue;
    const xml = await res.text();
    const attr = (name) => xml.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    const filesUrl = `${dzi.replace(/\.dzi$/, "")}_files/`;
    for (const format of [...new Set([attr("Format"), "jpeg", "jpg"])].filter(Boolean)) {
      if ((await request(`${filesUrl}8/0_0.${format}`, "HEAD")).status === 404) continue;
      return {
        tileSource: {
          Image: {
            xmlns: attr("xmlns"),
            Url: filesUrl,
            Format: format,
            Overlap: Number(attr("Overlap")),
            TileSize: Number(attr("TileSize")),
            Size: { Width: Math.round(Number(attr("Width"))), Height: Math.round(Number(attr("Height"))) },
          },
        },
      };
    }
    return { dropped: "dzi has no tiles" };
  }
  return { dropped: "no dzi" };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// ---- field derivation
const isSlug = (title, e, repo) => !title || [repo, e.stainname, e.reponame].includes(title);
function stainLabel(id, repo) {
  const name = id.split("/").pop();
  if (name === "viewer_z0" || name === repo || /^case/i.test(name)) return "";
  // Only slide numbering is stripped (HE1, MGG-1); antibody digits stay (CD3, Ki67, p63).
  return name.replace(/[-_]\d+$/, "").replace(/^HE\d*(?=$|[-_])/, "H&E");
}

const book = { tr: readBook(SITES.tr[0]), en: readBook(SITES.en[0]) };
const list = readList();
const candidates = [...new Set([...list.keys(), ...book.tr.keys(), ...book.en.keys()])].filter((u) => !u.includes("template")).sort();
const eligible = candidates.filter((u) => book.tr.has(u) || book.en.has(u) || list.get(u)?.type === "published");

let probed = 0;
const results = await mapLimit(eligible, 8, async (url) => {
  const r = await probe(url);
  if (++probed % 50 === 0) console.error(`probed ${probed}/${eligible.length}`);
  return r;
});

const slides = [];
const dropped = candidates.filter((u) => !eligible.includes(u)).map((url) => ({ url, reason: "not in book and not published" }));
eligible.forEach((url, i) => {
  if (results[i].dropped) return dropped.push({ url, reason: results[i].dropped });
  const e = list.get(url) ?? {};
  const id = url.replace(/^https:\/\/images\.patolojiatlasi\.com\//, "").replace(/\.html$/, "");
  const repo = id.split("/")[0];
  const tr = book.tr.get(url), en = book.en.get(url);
  const heading = en?.heading || tr?.heading || "";
  const quiz = /^case[-\s]?\d+$/i.test(heading);
  let title_en, title_tr;
  if (quiz) {
    title_en = `${en?.pageTitle || tr?.pageTitle} – ${heading.replace(/-/, " ")}`;
    title_tr = `${tr?.pageTitle || en?.pageTitle} – ${(tr?.heading || heading).replace(/-/, " ")}`;
  } else {
    const listEn = isSlug(e.titleEN, e, repo) ? "" : e.titleEN;
    const listTr = isSlug(e.titleTR, e, repo) ? "" : e.titleTR;
    title_en = listEn || en?.heading || listTr || tr?.heading || id;
    title_tr = listTr || tr?.heading || listEn || en?.heading || id;
  }
  const categories = [...(e.categoriesEN ?? []), ...(e.categoriesTR ?? [])].map(String).filter((c) => !GENERIC_CATEGORIES.has(c.toLowerCase()));
  const terms = [
    tr?.heading, en?.heading, e.organEN, e.organTR, e.organ, e.speciality, e.note, ...categories,
    repo.replace(/[-_]/g, " "), ...(tr?.callouts ?? []), ...(en?.callouts ?? []), quiz ? "quiz" : "",
  ].filter((t) => t && typeof t === "string");
  slides.push({
    id,
    case: repo,
    stain: stainLabel(id, repo),
    title_en: String(title_en),
    title_tr: String(title_tr),
    ...(quiz && { quiz: true }),
    atlas_url_en: en?.url ?? null,
    atlas_url_tr: tr?.url ?? null,
    viewer_url: url,
    terms: [...new Set(terms)].join(" | "),
    ...results[i],
  });
});
slides.sort((a, b) => a.id.localeCompare(b.id));

const byReason = Object.groupBy(dropped, (d) => d.reason);
console.log(`included ${slides.length} slides in ${new Set(slides.map((s) => s.case)).size} cases`);
for (const [reason, items] of Object.entries(byReason)) console.log(`dropped ${items.length}: ${reason}`);
const inBookDropped = dropped.filter((d) => book.tr.has(d.url) || book.en.has(d.url));
if (inBookDropped.length) console.log("dropped but shown in the book:\n  " + inBookDropped.map((d) => `${d.url} (${d.reason})`).join("\n  "));

const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")).slides.length : 0;
if (!FORCE && slides.length < previous * 0.95) {
  console.error(`refusing to write: ${slides.length} slides is >5% below the committed ${previous} (use --force)`);
  process.exit(1);
}
fs.writeFileSync(OUT, JSON.stringify({ slides }, null, 1) + "\n");
console.log(`wrote ${OUT} (${fs.statSync(OUT).size} bytes)`);
