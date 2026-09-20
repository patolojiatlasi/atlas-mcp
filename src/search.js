// Pure search over data/catalog.json. No I/O, so node --test can import it directly.

const STOPWORDS = new Set([
  "a", "an", "the", "of", "for", "with", "in", "on", "and", "or", "me", "show", "find", "give", "please",
  "slide", "slides", "example", "examples", "image", "images", "stain", "stained", "case", "cases", "any",
  "can", "you", "what", "does", "look", "like", "see", "from", "that", "this", "there", "have", "some",
  "bana", "bir", "ve", "ile", "icin", "var", "mi", "nasil", "goster", "bul", "ornek", "ornegi", "kesit", "boya", "boyasi", "olgu", "vaka",
  "http", "https", "www", "com", "html", "sec", // URL fragments
]);

export const tokens = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\bh\s*&\s*e\b|hematoxylin(\s+and)?\s+eosin|hematoksilen(\s+ve)?\s+eozin/g, "he")
    .replace(/(\p{L})-(?=\p{N})/gu, "$1") // Ki-67 -> ki67, HER-2 -> her2, TTF-1 -> ttf1
    .replace(/\b(\p{L})-(?=\p{L})/gu, "$1") // c-erbB -> cerbb
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const matches = (queryToken, words) =>
  queryToken.length >= 4 ? words.some((w) => w.startsWith(queryToken)) : words.includes(queryToken);

export function buildIndex(catalog) {
  const entries = catalog.slides.map((slide) => {
    const titleWords = [...new Set(tokens([slide.title_en, slide.title_tr].join(" ")))];
    const allWords = [...new Set([...titleWords, ...tokens([slide.terms, slide.stain, slide.id].join(" "))])];
    return { slide, titleWords, allWords };
  });
  const byId = new Map(catalog.slides.map((s) => [s.id.toLowerCase(), s]));
  // Atlas section links (as returned by search) resolve to the first slide of that section.
  for (const s of catalog.slides) for (const url of [s.atlas_url_en, s.atlas_url_tr]) if (url && !byId.has(url.toLowerCase())) byId.set(url.toLowerCase(), s);
  const byCase = Map.groupBy(catalog.slides, (s) => s.case);
  return { entries, byId, byCase };
}

const caseSummary = (slide, slides) => ({
  case: slide.case,
  title_en: slide.title_en,
  title_tr: slide.title_tr,
  ...(slide.quiz && { quiz: true, note: "Self-assessment quiz case: the diagnosis is intentionally not included." }),
  atlas_url_en: slide.atlas_url_en,
  atlas_url_tr: slide.atlas_url_tr,
  slides: slides.map((s) => ({ id: s.id, stain: s.stain })),
});

export function searchSlides(index, query, limit = 8) {
  const queryTokens = [...new Set(tokens(query))].filter((t) => !STOPWORDS.has(t));
  const cases = new Map();
  for (const { slide, titleWords, allWords } of index.entries) {
    const score = queryTokens.filter((t) => matches(t, allWords)).length;
    if (!score) continue;
    const titleHits = queryTokens.filter((t) => matches(t, titleWords)).length;
    const c = cases.get(slide.case) ?? { best: null, score: 0, titleHits: 0 };
    if (score > c.score || (score === c.score && titleHits > c.titleHits)) Object.assign(c, { best: slide, score, titleHits });
    cases.set(slide.case, c);
  }
  const top = Math.max(0, ...[...cases.values()].map((c) => c.score));
  if (!top) {
    const seen = new Map(index.entries.map(({ slide }) => [slide.case, slide]));
    return {
      no_match: true,
      hint: "No keyword match. Pick a case from this list by meaning, or retry with synonyms (English or Turkish).",
      cases: [...seen.values()].map((s) => ({ case: s.case, title_en: s.title_en })),
    };
  }
  // Top score tier, plus the best title matches: a stray word matching elsewhere must not bury the real hits.
  const topTitle = Math.max(0, ...[...cases.values()].map((c) => c.titleHits));
  const ranked = [...cases.values()]
    .filter((c) => c.score === top || (topTitle > 0 && c.titleHits === topTitle))
    .sort((a, b) => b.score - a.score || b.titleHits - a.titleHits || a.best.case.localeCompare(b.best.case));
  return {
    total_cases: ranked.length,
    cases: ranked.slice(0, limit).map((c) => caseSummary(c.best, index.byCase.get(c.best.case))),
  };
}

export function findSlide(index, idOrUrl) {
  const key = String(idOrUrl ?? "")
    .trim()
    .replace(/^https?:\/\/images\.patolojiatlasi\.com\//i, "")
    .replace(/\.(html|dzi)$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
  return index.byId.get(key) ?? null;
}

// Named teaching regions a slide carries (build-catalog.mjs strips geometry; see data/catalog.json's `regions`).
// Quiz slides' region labels are diagnoses (written in QuPath) same as the `terms` field, so they never leave this
// function for a quiz slide: both show_slide and list_regions call this instead of reading `slide.regions` directly.
export function visibleRegions(slide) {
  return slide?.quiz ? [] : (slide?.regions ?? []);
}

// Same Turkish-safe case fold tokens() uses (İ/ı fold to plain i via NFD + combining-mark strip), but keeps the
// string intact instead of splitting into words: findRegion compares whole labels, not word sets.
const foldCase = (s) => String(s ?? "").toLowerCase().replace(/ı/g, "i").normalize("NFD").replace(/\p{M}/gu, "");

// Resolve a region reference (id or label, either language) against an already quiz-filtered region list.
// Id match first (exact, then case-insensitive), then case-insensitive label match in either language.
export function findRegion(regions, ref) {
  const needle = String(ref ?? "").trim();
  if (!needle || !regions?.length) return null;
  const folded = foldCase(needle);
  return (
    regions.find((r) => r.id === needle) ??
    regions.find((r) => foldCase(r.id) === folded) ??
    regions.find((r) => [r.label_en, r.label_tr].some((l) => l && foldCase(l) === folded)) ??
    null
  );
}

// Everything show_slide is allowed to hand back for one slide: strips `terms` (search-only, may hold a quiz
// diagnosis) and applies visibleRegions()'s quiz rule to `regions`, so the raw catalog record is never spread
// into structuredContent un-filtered. list_regions uses visibleRegions() directly; show_slide uses this.
export function publicSlide(slide) {
  const { tileSource, terms, regions, ...info } = slide;
  return { ...info, tileSource, regions: visibleRegions(slide) };
}
