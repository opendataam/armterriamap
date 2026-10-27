// Builds the region mapping layer for the marzes (provinces) of Armenia:
// boundaries from OpenStreetMap, vector tiles, the region id list and
// wwwroot/data/regions/regionMapping.json.
//
// usage: cd scripts/regions && npm install && npm run build-marz
import fs from "node:fs";
import path from "node:path";
import GeoJSONVT from "geojson-vt";
import osmtogeojson from "osmtogeojson";
import vtpbf from "vt-pbf";

const OUT = path.resolve(import.meta.dirname, "../../wwwroot/data/regions");
const LAYER = "arm_marz";
const MAX_ZOOM = 11;

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_QUERY = `[out:json][timeout:180];
area["ISO3166-1"="AM"][admin_level=2]->.am;
rel(area.am)[boundary=administrative][admin_level=4]["ISO3166-2"];
out body;
>;
out skel qt;`;

// Spellings of each marz found in statistical tables, matched against the
// lower-cased cell value. Every variant is replaced with the ISO 3166-2 code,
// so a CSV column can hold codes or names in English, Armenian or Russian
// ("Aragatsotn", "Արագածոտնի մարզ", "Арагацотнская область", "AM02").
// Only lower-case regex syntax: terriajs lower-cases the patterns.
const VARIANTS = {
  "AM-AG": ["aragats?otn", "արագածոտն", "арагацотн", "am02"],
  "AM-AR": ["ararat", "արարատ", "арарат", "am03"],
  "AM-AV": ["armavir", "արմավիր", "армавир", "am04"],
  "AM-ER": [
    "(?:c\\. ?|city of )?y?erevan",
    "(?:ք\\. ?)?եր[ևեւ]+ան",
    "(?:г\\. ?|город )?ереван",
    "am01"
  ],
  "AM-GR": [
    "gegh?ar ?k'?unik",
    "գեղարքունիք",
    "гех?аркуник",
    "гегаркуник",
    "am05"
  ],
  "AM-KT": ["kotay[kq]", "կոտայք", "котайк", "am07"],
  "AM-LO": ["lori", "լոռ[իու]", "лори", "am06"],
  "AM-SH": ["shirak", "շիրակ", "ширак", "am08"],
  "AM-SU": ["s[iy]uni[kq]", "սյունիք", "сюник", "am09"],
  "AM-TV": ["tavush", "տավուշ", "тавуш", "am11"],
  "AM-VD": ["vayot[sz]'?[ -]?dzor", "վայոց ձոր", "вайоц[ -]?дзор", "am10"]
};

// Rest of the word (inflection, apostrophe) and an optional "province" word,
// e.g. "Арагацотн|ская область", "Արագածոտն|ի մարզ", "Syunik|' province".
const SUFFIX =
  "[^ ,-]*(?: (?:province|marz|region|city|область|марз|регион|մարզ))?";

const ALIASES = [
  "arm_marz",
  "marz",
  "marz_code",
  "marz_iso",
  "marz_name",
  "marz_en",
  "marz_hy",
  "marz_ru",
  "province",
  "province_name",
  "region",
  "adm1_pcode",
  "adm1_en",
  "adm1_hy",
  "adm1_ru",
  "adm1_name",
  "adm1",
  "iso_3166_2",
  "iso3166_2",
  "մարզ",
  "марз",
  "область",
  "регион"
];

const round = (coords) =>
  typeof coords[0] === "number"
    ? coords.map((c) => Math.round(c * 1e5) / 1e5)
    : coords.map(round);

async function queryOverpass(attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent":
          "armterriamap-regions (https://github.com/opendataam/armterriamap)"
      },
      body: new URLSearchParams({ data: OVERPASS_QUERY })
    });
    if (response.ok) return response.json();
    // Overpass answers 429/502/504 when it is busy
    if (attempt === attempts)
      throw new Error(`Overpass: HTTP ${response.status}`);
    console.warn(`Overpass: HTTP ${response.status}, retrying`);
    await new Promise((resolve) => setTimeout(resolve, 15000 * attempt));
  }
}

async function fetchMarzes() {
  const geojson = osmtogeojson(await queryOverpass());
  return geojson.features
    .filter(
      (f) =>
        f.id.startsWith("relation/") &&
        ["Polygon", "MultiPolygon"].includes(f.geometry.type)
    )
    .map((f) => ({ ...f, tags: f.properties.tags ?? f.properties }))
    .sort((a, b) => a.tags["ISO3166-2"].localeCompare(b.tags["ISO3166-2"]))
    .map((f, fid) => ({
      type: "Feature",
      properties: {
        FID: fid,
        iso: f.tags["ISO3166-2"],
        name_en: f.tags["name:en"],
        name_hy: f.tags["name:hy"] ?? f.tags.name,
        name_ru: f.tags["name:ru"],
        wikidata: f.tags.wikidata,
        osm_id: f.id
      },
      geometry: {
        type: f.geometry.type,
        coordinates: round(f.geometry.coordinates)
      }
    }));
}

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

function writeTiles(collection) {
  const dir = path.join(OUT, LAYER);
  fs.rmSync(dir, { recursive: true, force: true });
  const index = new GeoJSONVT(collection, {
    maxZoom: MAX_ZOOM,
    indexMaxZoom: MAX_ZOOM,
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
      vtpbf.fromGeojsonVt({ [LAYER]: tile }, { version: 2 })
    );
    count++;
  }
  return count;
}

const features = await fetchMarzes();
const missing = Object.keys(VARIANTS).filter(
  (iso) => !features.some((f) => f.properties.iso === iso)
);
if (features.length !== 11 || missing.length > 0) {
  throw new Error(
    `Expected 11 marzes, got ${features.length}; missing ${missing}`
  );
}
const collection = { type: "FeatureCollection", features };

fs.mkdirSync(path.join(OUT, "regionids"), { recursive: true });
fs.writeFileSync(
  path.join(OUT, `${LAYER}.geojson`),
  JSON.stringify(collection)
);
fs.writeFileSync(
  path.join(OUT, "regionids", `${LAYER}_iso.json`),
  JSON.stringify({
    layer: LAYER,
    property: "iso",
    values: features.map((f) => f.properties.iso)
  })
);
const tiles = writeTiles(collection);

const regionMapping = {
  regionWmsMap: {
    ARM_MARZ: {
      layerName: LAYER,
      server: `data/regions/${LAYER}/{z}/{x}/{y}.pbf`,
      serverType: "MVT",
      serverMinZoom: 0,
      serverMaxNativeZoom: MAX_ZOOM,
      serverMaxZoom: 28,
      regionIdsFile: `data/regions/regionids/${LAYER}_iso.json`,
      uniqueIdProp: "FID",
      regionProp: "iso",
      nameProp: "name_en",
      textCodes: true,
      aliases: ALIASES,
      dataReplacements: Object.entries(VARIANTS).flatMap(([iso, variants]) =>
        variants.map((v) => [`^(?:${v})${SUFFIX}$`, iso.toLowerCase()])
      ),
      description: "Marzes (provinces) of Armenia",
      bbox: bbox(features)
    }
  }
};
fs.writeFileSync(
  path.join(OUT, "regionMapping.json"),
  JSON.stringify(regionMapping, null, 2) + "\n"
);

console.log(`${features.length} marzes, ${tiles} tiles, written to ${OUT}`);
