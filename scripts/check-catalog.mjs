// Checks that every layer of the catalog (wwwroot/init/*.json) can be loaded:
// WMS layers are listed in GetCapabilities, files and tiles answer, CKAN
// datasets and resources exist. Exits with code 1 if anything is broken.
//
// usage: node scripts/check-catalog.mjs [wwwroot/init/simple.json ...]
import fs from "node:fs";
import path from "node:path";

const WWWROOT = path.resolve(import.meta.dirname, "../wwwroot");
const TIMEOUT_MS = 60000;
// A tile inside Armenia for URL templates
const TILE = { z: 6, x: 40, y: 24 };

const files = process.argv.slice(2);
if (files.length === 0) files.push(path.join(WWWROOT, "init/simple.json"));

async function request(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "armterriamap-catalog-check (https://github.com/opendataam/armterriamap)"
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

// Only the response headers are needed for files: stop reading the body
async function checkFile(url) {
  const response = await request(url);
  await response.body?.cancel();
  return `HTTP ${response.status}`;
}

async function ckanAction(base, action, params) {
  const url = `${base.replace(/\/$/, "")}/api/3/action/${action}?${new URLSearchParams(params)}`;
  const json = await (await request(url)).json();
  if (!json.success)
    throw new Error(`CKAN ${action}: ${JSON.stringify(json.error)}`);
  return json.result;
}

const capabilities = new Map();
function wmsLayerNames(url) {
  if (!capabilities.has(url)) {
    const capsUrl = new URL(url);
    capsUrl.searchParams.set("service", "WMS");
    capsUrl.searchParams.set("request", "GetCapabilities");
    capabilities.set(
      url,
      request(capsUrl)
        .then((r) => r.text())
        .then(
          (xml) =>
            new Set(
              [...xml.matchAll(/<Name>([^<]+)<\/Name>/g)].map((m) => m[1])
            )
        )
    );
  }
  return capabilities.get(url);
}

const checks = {
  async wms(item) {
    const names = await wmsLayerNames(item.url);
    const missing = item.layers.split(",").filter((l) => !names.has(l));
    if (missing.length) throw new Error(`not in GetCapabilities: ${missing}`);
    return "layer listed";
  },
  async "ckan-item"(item) {
    const resource = await ckanAction(item.url, "resource_show", {
      id: item.resourceId
    });
    if (resource.package_id === undefined)
      throw new Error("resource without dataset");
    return `${await checkFile(resource.url)} ${resource.format}`;
  },
  async "ckan-group"(item) {
    const fq = item.filterQuery.map((q) => q.fq ?? q).join(" ");
    const result = await ckanAction(item.url, "package_search", {
      fq,
      rows: 0
    });
    if (result.count === 0) throw new Error(`no datasets for ${fq}`);
    return `${result.count} datasets`;
  },
  async "url-template-imagery"(item) {
    const url = item.url
      .replace("{z}", TILE.z)
      .replace("{x}", TILE.x)
      .replace("{y}", TILE.y);
    return checkFile(url);
  }
};
for (const type of ["geojson", "csv", "kml", "czml", "gpx", "shp"]) {
  checks[type] = (item) => checkFile(item.url);
}

function* items(entries, groupPath = []) {
  for (const entry of entries ?? []) {
    if (entry.type === "group") {
      yield* items(entry.members, [...groupPath, entry.id ?? entry.name]);
    } else {
      yield { item: entry, group: groupPath.join(" / ") };
    }
  }
}

let failed = 0;
for (const file of files) {
  const init = JSON.parse(fs.readFileSync(file, "utf8"));
  const results = await Promise.all(
    [...items(init.catalog)].map(async ({ item, group }) => {
      const label = `${group} / ${item.id ?? item.name} (${item.type})`;
      const check = checks[item.type];
      if (!check) return { label, ok: true, info: "not checked" };
      // Relative URLs are files served from wwwroot
      if (item.url && !/^https?:/.test(item.url) && item.type !== "ckan-item") {
        const exists = fs.existsSync(path.join(WWWROOT, item.url));
        return {
          label,
          ok: exists,
          info: exists ? "local file" : `missing ${item.url}`
        };
      }
      try {
        return { label, ok: true, info: await check(item) };
      } catch (e) {
        return { label, ok: false, info: e.cause?.message ?? e.message };
      }
    })
  );
  console.log(`## ${path.relative(process.cwd(), file)}`);
  for (const r of results) {
    console.log(`${r.ok ? "OK  " : "FAIL"} ${r.label}: ${r.info}`);
    if (!r.ok) failed++;
  }
}
console.log(
  failed ? `\n${failed} broken layer(s)` : "\nAll layers are reachable"
);
process.exit(failed ? 1 : 0);
