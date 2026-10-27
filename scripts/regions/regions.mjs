// Shared code of the region mapping builders: writes a region layer
// (GeoJSON, vector tiles, region id list) to wwwroot/data/regions and adds
// its region type to wwwroot/data/regions/regionMapping.json.
import fs from "node:fs";
import path from "node:path";
import GeoJSONVT from "geojson-vt";
import vtpbf from "vt-pbf";

export const OUT = path.resolve(
  import.meta.dirname,
  "../../wwwroot/data/regions"
);

export const USER_AGENT =
  "armterriamap-regions (https://github.com/opendataam/armterriamap)";

export const round = (coords) =>
  typeof coords[0] === "number"
    ? coords.map((c) => Math.round(c * 1e5) / 1e5)
    : coords.map(round);

function bbox(features) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (c) => {
    if (typeof c[0] === "number") {
      b[0] = Math.min(b[0], c[0]);
      b[1] = Math.min(b[1], c[1]);
      b[2] = Math.max(b[2], c[0]);
      b[3] = Math.max(b[3], c[1]);
    } else c.forEach(visit);
  };
  features.forEach((f) => visit(f.geometry.coordinates));
  return b.map((v) => Math.round(v * 100) / 100);
}

function writeTiles(collection, layer, maxZoom) {
  const dir = path.join(OUT, layer);
  fs.rmSync(dir, { recursive: true, force: true });
  const index = new GeoJSONVT(collection, {
    maxZoom,
    indexMaxZoom: maxZoom,
    indexMaxPoints: 0
  });
  let count = 0;
  for (const { z, x, y } of index.tileCoords) {
    const tile = index.getTile(z, x, y);
    if (!tile) continue;
    const file = path.join(dir, `${z}/${x}/${y}.pbf`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      vtpbf.fromGeojsonVt({ [layer]: tile }, { version: 2 })
    );
    count++;
  }
  return count;
}

/**
 * Writes a region layer and registers its region type.
 *
 * `features` must have a `FID` property counting from 0 in feature order and
 * the `regionProp` property with the region code. `variants` maps each code to
 * regexes of the spellings found in data tables; each match is replaced with
 * the code. terriajs lower-cases the patterns, so only lower-case regex syntax
 * may be used. `suffix` is appended to every variant pattern.
 */
export function writeRegionLayer({
  regionType,
  layer,
  features,
  regionProp,
  nameProp,
  maxZoom,
  aliases,
  variants,
  suffix,
  description
}) {
  const collection = { type: "FeatureCollection", features };
  fs.mkdirSync(path.join(OUT, "regionids"), { recursive: true });
  fs.writeFileSync(
    path.join(OUT, `${layer}.geojson`),
    JSON.stringify(collection)
  );
  fs.writeFileSync(
    path.join(OUT, "regionids", `${layer}_${regionProp}.json`),
    JSON.stringify({
      layer,
      property: regionProp,
      values: features.map((f) => f.properties[regionProp])
    })
  );
  const tiles = writeTiles(collection, layer, maxZoom);

  const file = path.join(OUT, "regionMapping.json");
  const regionMapping = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { regionWmsMap: {} };
  regionMapping.regionWmsMap[regionType] = {
    layerName: layer,
    server: `data/regions/${layer}/{z}/{x}/{y}.pbf`,
    serverType: "MVT",
    serverMinZoom: 0,
    serverMaxNativeZoom: maxZoom,
    serverMaxZoom: 28,
    regionIdsFile: `data/regions/regionids/${layer}_${regionProp}.json`,
    uniqueIdProp: "FID",
    regionProp,
    nameProp,
    textCodes: true,
    aliases,
    dataReplacements: Object.entries(variants).flatMap(([code, patterns]) =>
      patterns.map((p) => [`^(?:${p})${suffix}$`, code.toLowerCase()])
    ),
    description,
    bbox: bbox(features)
  };
  fs.writeFileSync(file, JSON.stringify(regionMapping, null, 2) + "\n");
  console.log(`${regionType}: ${features.length} regions, ${tiles} tiles`);
}
