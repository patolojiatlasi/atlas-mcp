import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import catalog from "../data/catalog.json" with { type: "json" };
import { mppFromVipsProperties, parseVipsProperties } from "../scripts/mpp.mjs";

const xml = (pairs) =>
  `<?xml version="1.0"?><image><properties>` +
  Object.entries(pairs)
    .map(([k, v]) => `<property><name>${k}</name><value type="VipsRefString">${v}</value></property>`)
    .join("") +
  `</properties></image>`;

test("reads the flat name/value pairs vips writes", () => {
  const props = parseVipsProperties(xml({ "aperio.AppMag": "40", "aperio.ScannerType": "GT450 DX" }));
  assert.equal(props["aperio.AppMag"], "40");
  assert.equal(props["aperio.ScannerType"], "GT450 DX");
});

test("xres and the scanner tag agree on a slide exported at full resolution", () => {
  // The real lymphocytic-gastritis/HE values.
  const r = mppFromVipsProperties(xml({ xres: "3802.0211544457038", "openslide.mpp-x": "0.263018" }));
  assert.ok(Math.abs(r.mpp - 0.263018) < 1e-6);
  assert.equal(r.disagrees, false);
});

test("xres wins over a stale scanner tag, and the disagreement is reported", () => {
  // Same slide exported at half size: xres halves, the scanner tag does not.
  const r = mppFromVipsProperties(xml({ xres: "1901.0105772228519", "openslide.mpp-x": "0.263018" }));
  assert.ok(Math.abs(r.mpp - 0.526036) < 1e-5, `got ${r.mpp}`);
  assert.equal(r.disagrees, true);
  assert.ok(Math.abs(r.recorded - 0.263018) < 1e-9);
});

test("an implausible placeholder resolution is discarded, not believed", () => {
  // xres=1 would imply 1000 um/px.
  const r = mppFromVipsProperties(xml({ xres: "1", "aperio.MPP": "0.263018" }));
  assert.ok(Math.abs(r.mpp - 0.263018) < 1e-9);
  assert.equal(mppFromVipsProperties(xml({ xres: "1" })).mpp, null);
});

test("aperio.MPP is used when openslide.mpp-x is absent", () => {
  assert.ok(Math.abs(mppFromVipsProperties(xml({ "aperio.MPP": "0.263018" })).mpp - 0.263018) < 1e-9);
});

test("a sidecar with no pixel size yields null rather than a guess", () => {
  assert.equal(mppFromVipsProperties(xml({ "aperio.AppMag": "40", bands: "4" })).mpp, null);
  assert.equal(mppFromVipsProperties("<image/>").mpp, null);
});

test("matches the real sidecar when the slide is checked out locally", (t) => {
  const real = "E:/atlas/lymphocytic-gastritis/HE_files/vips-properties.xml";
  if (!fs.existsSync(real)) return t.skip("real slide not present here");
  const r = mppFromVipsProperties(fs.readFileSync(real, "utf8"));
  assert.ok(Math.abs(r.mpp - 0.263018) < 1e-6, `got ${r.mpp}`);
  assert.equal(r.disagrees, false, "xres and aperio.MPP should agree on this slide");
});

test("published regions carry no QuPath-only fields", () => {
  // The exporter writes `uuid` (so a re-import keeps object identity) and optionally `geometry`.
  // Neither belongs in the Worker bundle: geometry would bloat it, uuid means nothing here.
  // build-catalog.mjs whitelists the fields it copies; this asserts the whitelist actually holds.
  for (const slide of catalog.slides) {
    for (const region of slide.regions ?? []) {
      assert.ok(!("uuid" in region), `${slide.id} region ${region.id} leaked a uuid`);
      assert.ok(!("geometry" in region), `${slide.id} region ${region.id} leaked geometry`);
    }
  }
});
