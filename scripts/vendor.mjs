// Copies the viewer's third-party scripts from node_modules into public/vendor (served by this Worker),
// so the viewer loads nothing from domains we don't control. Prints the SRI hashes for src/viewer.html.
// Run after upgrading openseadragon or @modelcontextprotocol/ext-apps, then update viewer.html and bump viewer-vN.
import fs from "node:fs";
import crypto from "node:crypto";

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8")).version;
const files = [
  ["node_modules/openseadragon/build/openseadragon/openseadragon.min.js", `openseadragon-${read("node_modules/openseadragon/package.json")}.min.js`],
  ["node_modules/@modelcontextprotocol/ext-apps/dist/src/app-with-deps.js", `ext-apps-${read("node_modules/@modelcontextprotocol/ext-apps/package.json")}-app-with-deps.js`],
];
for (const [from, name] of files) {
  fs.copyFileSync(from, `public/vendor/${name}`);
  const sri = "sha384-" + crypto.createHash("sha384").update(fs.readFileSync(from)).digest("base64");
  console.log(`/vendor/${name}  ${sri}`);
}
