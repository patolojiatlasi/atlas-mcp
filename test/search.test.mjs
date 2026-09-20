import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/catalog.json" with { type: "json" };
import { buildIndex, searchSlides, findSlide, tokens, visibleRegions, findRegion, publicSlide } from "../src/search.js";

const index = buildIndex(catalog);
const caseNames = (query) => searchSlides(index, query).cases.map((c) => c.case);

test("catalog invariants", () => {
  const ids = catalog.slides.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  assert.ok(catalog.slides.length > 150, "catalog is not suspiciously small");
  for (const s of catalog.slides) {
    assert.ok(!/[{}]/.test(s.id), `malformed id ${s.id}`);
    assert.ok(s.tileSource.Image.Size.Width > 0 && s.tileSource.Image.Size.Height > 0, `size of ${s.id}`);
    assert.match(s.tileSource.Image.Url, /^https:\/\/images\.patolojiatlasi\.com\/.+_files\/$/);
    assert.ok(s.atlas_url_en || s.atlas_url_tr || s.viewer_url, `link for ${s.id}`);
    assert.ok(s.title_en && s.title_tr, `titles for ${s.id}`);
  }
});

test("folding handles Turkish letters and H&E", () => {
  assert.deepEqual(tokens("Kristal Viyole İLE Işık H&E"), ["kristal", "viyole", "ile", "isik", "he"]);
});

test("finds cases in English and Turkish", () => {
  assert.ok(caseNames("amyloid").includes("amyloid"));
  assert.ok(caseNames("kristal viyole").includes("amyloid"));
  assert.ok(caseNames("lenfositik gastrit").includes("lymphocytic-gastritis"));
  assert.ok(caseNames("helicobacter").includes("helicobacterpylori"));
  assert.deepEqual(caseNames("signet ring cell carcinoma"), ["signet-ring-cell-carcinoma"]);
  assert.equal(caseNames("CD3 lymphocytic gastritis")[0], "lymphocytic-gastritis");
  assert.ok(caseNames("lymphoma").includes("hodgkin"), "chapter-title slides get the chapter title");
});

test("filler words and hyphenated markers do not derail ranking", () => {
  assert.equal(caseNames("Can you find colon adenocarcinoma?")[0], "colon-adenocarcinoma");
  assert.ok(caseNames("Kolon adenokarsinomu için kesit var mı?").includes("colon-adenocarcinoma"));
  assert.ok(caseNames("Ki-67").includes("secretory-meningioma"));
  assert.ok(!caseNames("c-erbB-2").some((c) => /^hacettepe|^GBD/.test(c)));
  assert.ok(caseNames("hematoxylin and eosin liver").length <= 20);
});

test("a case lists all of its stains", () => {
  const [c] = searchSlides(index, "glioblastoma GFAP").cases;
  assert.deepEqual(c.slides.map((s) => s.stain).sort(), ["GFAP", "H&E", "NFP"]);
});

test("short and filler words do not match everything", () => {
  assert.ok(searchSlides(index, "H&E liver").total_cases <= 20);
  assert.deepEqual(caseNames("show me a slide of lipoma"), ["colon-submucosal-lipoma"]);
});

test("quiz cases are findable by diagnosis without revealing it", () => {
  const [c] = searchSlides(index, "DSRCT").cases;
  assert.equal(c.case, "hacettepe-com-case-14");
  assert.equal(c.quiz, true);
  assert.doesNotMatch(JSON.stringify(c), /DSRCT|desmoplastic/i);
});

test("named regions: quiz slides never expose region labels via list_regions' visibleRegions()", () => {
  const quiz = catalog.slides.find((s) => s.id === "hacettepe-com-case-1/HE");
  assert.equal(quiz.quiz, true, "fixture is still a quiz slide");
  assert.ok(quiz.regions?.length, "fixture still carries a region whose label would leak the diagnosis");
  const visible = visibleRegions(quiz);
  assert.deepEqual(visible, [], "quiz regions are withheld entirely, not redacted field-by-field");
  assert.doesNotMatch(JSON.stringify(visible), /fasciitis/i);
  // findRegion only ever sees what visibleRegions returned, so a "region" param can't resolve to the hidden one either.
  assert.equal(findRegion(visible, "r1"), null);
  assert.equal(findRegion(visible, "Nodular fasciitis focus"), null);
});

test("named regions: quiz slides never expose region labels via show_slide's publicSlide() projection", () => {
  // This is the exact object show_slide spreads into structuredContent (worker.js: `{ ...publicSlide(slide) }`),
  // so this is the real leak path the task asked to regression-test, not just the visibleRegions() primitive.
  const quiz = catalog.slides.find((s) => s.id === "hacettepe-com-case-1/HE");
  const projected = publicSlide(quiz);
  assert.deepEqual(projected.regions, []);
  assert.ok(!("terms" in projected), "search-only terms field is also stripped");
  assert.doesNotMatch(JSON.stringify(projected), /fasciitis|nodular/i);
});

test("named regions: a normal slide's regions pass through untouched", () => {
  const slide = catalog.slides.find((s) => s.id === "lymphocytic-gastritis/HE");
  const regions = visibleRegions(slide);
  assert.equal(regions.length, 2);
  assert.equal(regions[0].id, "r1");
  assert.equal(regions[0].label_en, "Lymphoid aggregate");
  assert.equal(regions[0].x, 12000);
  assert.equal(regions[0].width, 3000, "coordinates preserved");
});

test("named regions: findRegion resolves by id and by case-insensitive label in either language", () => {
  const regions = visibleRegions(catalog.slides.find((s) => s.id === "lymphocytic-gastritis/HE"));
  assert.equal(findRegion(regions, "r1")?.label_en, "Lymphoid aggregate");
  assert.equal(findRegion(regions, "R2")?.label_en, "Intraepithelial lymphocytosis", "id match is case-insensitive on fallback");
  assert.equal(findRegion(regions, "lymphoid aggregate")?.id, "r1", "English label, case-insensitive");
  assert.equal(findRegion(regions, "LENFOID AGREGAT")?.id, "r1", "Turkish label, case-insensitive");
  assert.equal(findRegion(regions, "no such region"), null, "no-match path returns null, not a throw");
  assert.equal(findRegion(regions, ""), null);
  assert.equal(findRegion(regions, undefined), null);
});

test("named regions: findRegion folds Turkish letters (İ/ı), same as tokens()", () => {
  // r2's label_tr is "İntraepitelyal lenfositoz" (capital dotted İ). Plain .toLowerCase() turns İ into
  // "i" + a combining dot above, which would never equal a plain-ASCII "i" a model types.
  const regions = visibleRegions(catalog.slides.find((s) => s.id === "lymphocytic-gastritis/HE"));
  assert.equal(findRegion(regions, "intraepitelyal lenfositoz")?.id, "r2");
  assert.equal(findRegion(regions, "İNTRAEPİTELYAL LENFOSİTOZ")?.id, "r2", "uppercase Turkish dotted-I form too");
});

test("named regions: publicSlide() attaches quiz-safe regions and drops terms, for a normal slide too", () => {
  const slide = catalog.slides.find((s) => s.id === "lymphocytic-gastritis/HE");
  const projected = publicSlide(slide);
  assert.ok(!("terms" in projected));
  assert.equal(projected.regions.length, 2);
  assert.equal(projected.tileSource.Image.Size.Width, 79923, "tileSource still present");
  assert.equal(projected.mpp, 0.263018);
});

test("named regions: slides without a regions.json probe behave exactly as before", () => {
  const slide = catalog.slides.find((s) => s.id === "abdominal-mesothelioma/HE");
  assert.ok(!("regions" in slide), "fixture has no regions field, same as an un-probed slide");
  assert.deepEqual(visibleRegions(slide), []);
  assert.equal(findRegion(visibleRegions(slide), "anything"), null);
});

test("no keyword hit returns the case list for the model to choose from", () => {
  const r = searchSlides(index, "xyzzy qwerty");
  assert.equal(r.no_match, true);
  assert.equal(r.cases.length, new Set(catalog.slides.map((s) => s.case)).size);
  assert.ok(JSON.stringify(r).length < 20_000);
});

test("findSlide accepts ids in any case and viewer URLs", () => {
  assert.equal(findSlide(index, "bs18/pas")?.id, "BS18/PAS");
  assert.equal(findSlide(index, "https://images.patolojiatlasi.com/amyloid/crystalviolet.html")?.id, "amyloid/crystalviolet");
  const bs18 = catalog.slides.find((s) => s.id === "BS18/HE1");
  assert.equal(findSlide(index, bs18.atlas_url_tr)?.case, "BS18", "atlas section links resolve");
  assert.equal(findSlide(index, "nope/HE"), null);
});

test("viewer loads only self-hosted scripts whose SRI hashes match public/vendor", async () => {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const html = readFileSync(new URL("../src/viewer.html", import.meta.url), "utf8");
  const external = [...html.matchAll(/https?:\/\/[^"'\s)]+/g)].map((m) => m[0]);
  assert.deepEqual(external, [], "no hard-coded external URLs (use %ORIGIN%)");
  const pins = [...html.matchAll(/"?%ORIGIN%(\/vendor\/[^"]+)"?\s*(?:\n\s*)?integrity="(sha384-[^"]+)"|"%ORIGIN%(\/vendor\/[^"]+)":\s*"(sha384-[^"]+)"/g)]
    .map((m) => [m[1] ?? m[3], m[2] ?? m[4]]);
  assert.equal(pins.length, 2);
  for (const [file, sri] of pins) {
    const actual = "sha384-" + createHash("sha384").update(readFileSync(new URL(`../public${file}`, import.meta.url))).digest("base64");
    assert.equal(actual, sri, file);
  }
});
