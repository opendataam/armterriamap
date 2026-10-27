# armterriamap

TerriaJS based armenian community national map. Configuration and settings for maps.opendata.am

The repository is a fork of [TerriaMap](https://github.com/TerriaJS/TerriaMap) v0.4.8 (TerriaJS 8.13.0).
The application is built from source; compiled output (`wwwroot/build/`) is not stored in git.

## Repository layout

- `wwwroot/config.json` - map configuration (app name, languages, search, help)
- `wwwroot/init/simple.json` - data catalog
- `wwwroot/languages/<lng>/languageOverrides.json` - translations of the interface and map-specific texts
- `wwwroot/data/` - data files served with the map
- `wwwroot/about.html` - about page
- `lib/`, `index.js`, `gulpfile.js`, `buildprocess/` - TerriaMap application source
- `serverconfig.json` - terriajs-server configuration (proxy whitelist etc.)

## How to

### Run with Docker

```bash
docker compose up -d --build
```

The map is served at http://localhost:3001. The image builds TerriaMap from source,
so no local Node.js is needed.

`docker-compose.yml` mounts `wwwroot/config.json`, `wwwroot/init/` and `wwwroot/languages/`
into the container, so edits to the catalog, config and translations apply after
a browser refresh, without a rebuild. Any other change needs `docker compose up -d --build`.

### Develop locally

Requires Node.js >= 22.

```bash
yarn install
yarn gulp dev
```

### Translation

1. Languages are enabled in `wwwroot/config.json` (`languageConfiguration`): English (`en`), Armenian (`hy`) and Russian (`ru`).
   The language can be set in the URL with `?lng=hy`
2. Edit `wwwroot/languages/<lng>/languageOverrides.json`. Keys in this file take precedence
   over the TerriaJS translations, so it can contain both map-specific texts and translations
   of any TerriaJS interface string (see `node_modules/terriajs/wwwroot/languages/en/translation.json`
   for the list of keys)
3. Refresh the browser

### Adding data

1. Publish the data on [data.opendata.am](https://data.opendata.am), or upload it to `wwwroot/data`
2. Write new record to `wwwroot/init/simple.json` to add it to the public catalog

Check that every layer of the catalog can be loaded from its source (no dependencies, Node.js >= 22):

```bash
node scripts/check-catalog.mjs
```

The GitHub Actions workflow "Check catalog" runs the same check weekly and on pull requests that change
`wwwroot/init/`.

Catalog names and descriptions are written as translation keys, e.g. `"name": "translate#catalog.climate.zones"`,
with the texts under `catalog` in `wwwroot/languages/{en,hy,ru}/languageOverrides.json`. TerriaJS itself does not
translate catalog entries; `index.js` replaces the keys when the map loads and when the language changes.

Resources of data.opendata.am are served without CORS headers, so the map loads them through
the terriajs-server proxy (`allowProxyFor` in `serverconfig.json`).

### Data from data.opendata.am

The atlas data lives in the [Open Data Armenia catalogue](https://data.opendata.am) and is loaded
when the map opens:

- Catalog entries of type `ckan-item` reference a CKAN dataset and resource by id
  (`datasetId`, `resourceId`); the data URL, description and licence come from CKAN.
  TerriaJS does not apply styling traits to `ckan-item`, so layers that need a style
  (e.g. a choropleth) use their own type (`csv`, `geojson`) with the CKAN resource URL.
- The group "Open Data Armenia: datasets for the atlas" (`ckan-group`) lists every dataset tagged
  `atlas` on data.opendata.am, grouped by CKAN group. Tag a dataset `atlas` to add it to the map.

After rebuilding the marz boundaries, upload the new GeoJSON to the CKAN dataset
[armenia-marz-boundaries-osm](https://data.opendata.am/dataset/armenia-marz-boundaries-osm)
(`CKAN_API_TOKEN` is a token of a user who can edit the dataset):

```bash
curl -H "Authorization: $CKAN_API_TOKEN" -F id=88d2a994-b95a-4684-8a10-a716269b8dcd -F upload=@wwwroot/data/regions/arm_marz.geojson https://data.opendata.am/api/3/action/resource_update
```

### Region mapping (choropleths by marz)

A CSV with a column of marzes is shown as a choropleth without any configuration. The column is
recognised by its name (`marz`, `province`, `region`, `adm1_pcode`, `adm1_en`, `մարզ`, `марз`,
`область`, ...) and its values can be:

- ISO 3166-2 codes: `AM-ER`, `AM-SH`
- OCHA P-codes: `AM01` ... `AM11`
- names in English, Armenian or Russian: `Shirak`, `Շիրակի մարզ`, `Ширакская область`, `г. Ереван`

The region type is `ARM_MARZ`, defined in `wwwroot/data/regions/regionMapping.json`. Boundaries,
vector tiles and the region id list are built from OpenStreetMap by:

```bash
cd scripts/regions && npm install && npm run build-marz
```

The script overwrites `wwwroot/data/regions/`; edit the spelling variants in
`scripts/regions/build-marz.mjs`, not the generated files.

### Updating TerriaMap

Apply the upstream changes between the current and the new TerriaMap release, excluding
the files customised here, then review and resolve conflicts:

```bash
git clone https://github.com/TerriaJS/TerriaMap /tmp/TerriaMap
git -C /tmp/TerriaMap diff v0.4.8 <new-version> -- . ':!wwwroot/config.json' ':!wwwroot/init' ':!wwwroot/languages' ':!README.md' | git apply -3
```
