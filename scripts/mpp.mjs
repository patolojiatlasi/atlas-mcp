/**
 * Pixel size from a `vips-properties.xml` sidecar.
 *
 * Kept in its own module (rather than inside build-catalog.mjs, which runs the whole build on
 * import) so the precedence rules can be unit-tested directly.
 *
 * The precedence MUST stay identical to the QuPath extension's
 * `DziImageServer.mppFromVipsProperties`, or the same slide would report one pixel size in the
 * catalog and a different one in QuPath.
 */

/** Parse the sidecar's flat <property><name>/<value> pairs. */
export function parseVipsProperties(xml) {
  const props = {};
  for (const m of xml.matchAll(/<name>([^<]*)<\/name>\s*<value[^>]*>([^<]*)<\/value>/g)) {
    props[m[1]] = m[2];
  }
  return props;
}

/**
 * A slide scanner produces roughly 0.1-2 um/px. A pyramid written from a source with no resolution
 * information can carry `xres=1` (one pixel per millimetre), which presents as 1000 um/px.
 */
function plausible(v) {
  return Number.isFinite(v) && v >= 0.01 && v <= 100 ? v : null;
}

/**
 * @param {string} xml raw `vips-properties.xml`
 * @returns {{mpp: number|null, fromXres: number|null, recorded: number|null, disagrees: boolean}}
 *   `mpp` is the value to use; the rest is reported so the caller can warn.
 */
export function mppFromVipsProperties(xml) {
  const props = parseVipsProperties(xml);

  // xres wins: vips computes it for the image it actually WROTE, so it stays correct even when a
  // slide was downsampled between the scanner and dzsave. openslide.mpp-x / aperio.MPP describe the
  // ORIGINAL slide and go stale in exactly that case.
  const xres = Number(props["xres"]); // pixels per millimetre
  const fromXres = plausible(Number.isFinite(xres) && xres > 0 ? 1000 / xres : NaN);
  const recorded = plausible(Number(props["openslide.mpp-x"] ?? props["aperio.MPP"]));

  const disagrees =
    fromXres != null &&
    recorded != null &&
    Math.abs(fromXres - recorded) / Math.max(fromXres, recorded) > 0.05;

  return { mpp: fromXres ?? recorded, fromXres, recorded, disagrees };
}
