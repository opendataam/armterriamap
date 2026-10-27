// Builds the region mapping layer for the marzes (provinces) of Armenia:
// boundaries from OpenStreetMap, vector tiles, the region id list and the
// ARM_MARZ region type in wwwroot/data/regions/regionMapping.json.
//
// usage: cd scripts/regions && npm install && npm run build-marz
import osmtogeojson from "osmtogeojson";
import { round, USER_AGENT, writeRegionLayer } from "./regions.mjs";

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

// Up to 5 more letters of the word (inflection, apostrophe) and an optional
// "province" word,
// e.g. "Лори|йская область", "Արագածոտն|ի մարզ", "Syunik|' province".
const SUFFIX =
  "[^ ,-]{0,5}(?: (?:province|marz|region|city|область|марз|регион|մարզ))?";

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

async function queryOverpass(attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": USER_AGENT
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

const features = await fetchMarzes();
const missing = Object.keys(VARIANTS).filter(
  (iso) => !features.some((f) => f.properties.iso === iso)
);
if (features.length !== 11 || missing.length > 0) {
  throw new Error(
    `Expected 11 marzes, got ${features.length}; missing ${missing}`
  );
}
writeRegionLayer({
  regionType: "ARM_MARZ",
  layer: LAYER,
  features,
  regionProp: "iso",
  nameProp: "name_en",
  maxZoom: MAX_ZOOM,
  aliases: ALIASES,
  variants: VARIANTS,
  suffix: SUFFIX,
  description: "Marzes (provinces) of Armenia"
});
