// Builds the region mapping layer for the 12 administrative districts of
// Yerevan: boundaries from the Yerevan Municipality GIS (gis.yerevan.am),
// vector tiles, the region id list and the ARM_YEREVAN_DISTRICT region type
// in wwwroot/data/regions/regionMapping.json.
//
// usage: cd scripts/regions && npm install && npm run build-yerevan-districts
import { round, USER_AGENT, writeRegionLayer } from "./regions.mjs";

const LAYER = "arm_yerevan_district";
const MAX_ZOOM = 13;
const SOURCE =
  "https://gis.yerevan.am/server/rest/services/Hosted/Yerevan_Districts/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson";

// Names in English, Russian and Armenian by official district code
// (community_code of the source layer). Spellings found in data tables are
// matched against the lower-cased cell value and replaced with the code.
// Only lower-case regex syntax: terriajs lower-cases the patterns.
const DISTRICTS = {
  "01-001": [
    "Ajapnyak",
    "Аджапняк",
    ["ajapnyak", "adjapnyak", "аджапняк", "աջափնյակ"]
  ],
  "01-002": ["Avan", "Аван", ["avan", "аван", "ավան"]],
  "01-003": ["Arabkir", "Арабкир", ["arabkir", "арабкир", "արաբկիր"]],
  "01-004": ["Davtashen", "Давташен", ["davtashen", "давташен", "դավթաշեն"]],
  "01-005": ["Erebuni", "Эребуни", ["erebuni", "эребуни", "էրեբունի"]],
  "01-006": ["Kentron", "Кентрон", ["kentron", "кентрон", "центр", "կենտրոն"]],
  "01-007": [
    "Malatia-Sebastia",
    "Малатия-Себастия",
    [
      "malat[iy]a[ -]?sebast[iy]a",
      "малатия[ -]?себастия",
      "մալաթիա[ -]?սեբաստիա"
    ]
  ],
  "01-008": [
    "Nor Nork",
    "Нор-Норк",
    ["nor[ -]?nork", "нор[ -]?норк", "նոր[ -]?նորք"]
  ],
  "01-009": [
    "Nork-Marash",
    "Норк-Мараш",
    ["nork[ -]?marash", "норк[ -]?мараш", "նորք[ -]?մարաշ"]
  ],
  "01-010": [
    "Nubarashen",
    "Нубарашен",
    ["nubarashen", "нубарашен", "նուբարաշեն"]
  ],
  "01-011": ["Shengavit", "Шенгавит", ["shengavit", "шенгавит", "շենգավիթ"]],
  "01-012": [
    "Kanaker-Zeytun",
    "Канакер-Зейтун",
    ["kanaker[ -]?ze[iy]tun", "канакер[ -]?зейтун", "քանաքեռ[ -]?զեյթուն"]
  ]
};

// Up to 4 more letters of the word (inflection) and an optional "district" word,
// e.g. "Kentron district", "Կենտրոն վարչական շրջան", "Кентрон район".
const SUFFIX =
  "[^ ,-]{0,4}(?: (?:district|administrative district|վարչական շրջան|շրջան|район|административный район))?";

const ALIASES = [
  "arm_yerevan_district",
  "yerevan_district",
  "district",
  "district_code",
  "community_code",
  "վարչական_շրջան",
  "շրջան",
  "район"
];

const response = await fetch(SOURCE, {
  headers: { "User-Agent": USER_AGENT }
});
if (!response.ok) throw new Error(`gis.yerevan.am: HTTP ${response.status}`);
const source = await response.json();

const features = source.features
  .sort((a, b) =>
    a.properties.community_code.localeCompare(b.properties.community_code)
  )
  .map((f, fid) => {
    const code = f.properties.community_code;
    if (!DISTRICTS[code]) throw new Error(`Unknown district code ${code}`);
    const [nameEn, nameRu] = DISTRICTS[code];
    return {
      type: "Feature",
      properties: {
        FID: fid,
        code,
        name_en: nameEn,
        name_hy: f.properties.settlement_name,
        name_ru: nameRu
      },
      geometry: {
        type: f.geometry.type,
        coordinates: round(f.geometry.coordinates)
      }
    };
  });
if (features.length !== 12) {
  throw new Error(`Expected 12 districts, got ${features.length}`);
}

writeRegionLayer({
  regionType: "ARM_YEREVAN_DISTRICT",
  layer: LAYER,
  features,
  regionProp: "code",
  nameProp: "name_en",
  maxZoom: MAX_ZOOM,
  aliases: ALIASES,
  variants: Object.fromEntries(
    Object.entries(DISTRICTS).map(([code, [, , patterns]]) => [
      code,
      [code.replace("-", "\\-"), ...patterns]
    ])
  ),
  suffix: SUFFIX,
  description:
    "Administrative districts of Yerevan (source: Yerevan Municipality GIS)"
});
