import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/catalog.json" with { type: "json" };
import { buildIndex, searchSlides, findSlide, tokens } from "../src/search.js";

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
