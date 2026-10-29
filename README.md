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
- `patches/` - fixes to dependencies (TerriaJS), applied to `node_modules` by `patch-package` after `yarn install`

## How to

### Run with Docker

```bash
docker compose up -d --build
```

The map is served at http://localhost:3001. The image builds TerriaMap from source,
so no local Node.js is needed. The build needs about 5 GB of memory in Docker. If
`docker compose` stops with "cannot allocate memory", build the image with `docker build`
and start it without building:

```bash
docker build -t armterriamap:latest . && docker compose up -d --no-build --force-recreate
```

`docker-compose.yml` mounts `wwwroot/config.json`, `wwwroot/init/` and `wwwroot/languages/`
into the container, so edits to the catalog, config and translations apply after
a browser refresh, without a rebuild. Any other change needs `docker compose up -d --build`.

### Deploy on a server

maps.opendata.am runs on a Hetzner CX23 (2 vCPU, 4 GB RAM, Ubuntu) with Docker, 4 GB of swap for
the build and ufw allowing only ports 22, 80 and 443. `deploy/server/docker-compose.server.yml` adds
[Caddy](https://caddyserver.com), which gets the TLS certificate from Let's Encrypt and proxies to
the atlas; terriajs-server listens only on `127.0.0.1:3001`. The DNS record of the site must point
to the server before Caddy can get the certificate.

First installation, as root:

```bash
git clone https://github.com/opendataam/armterriamap.git /opt/armterriamap && cd /opt/armterriamap
echo "COMPOSE_FILE=docker-compose.yml:deploy/server/docker-compose.server.yml" > .env
docker build -t armterriamap:latest . && docker compose up -d --no-build
```

`.env` makes plain `docker compose` commands use both files; add `SITE_ADDRESS=...` to it to serve
another domain. The build takes about 10 minutes on this server.

Updates of the catalog, config or translations (`config.json` is mounted as a single file, which
`git pull` replaces, so the container is restarted):

```bash
cd /opt/armterriamap && git pull && docker compose restart terriamap
```

Updates of the application code:

```bash
cd /opt/armterriamap && git pull && docker build -t armterriamap:latest . && docker compose up -d --no-build
```

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

The story "Armenia in maps" is the `stories` list of `wwwroot/init/simple.json`: each scene sets the
workbench (catalog item ids) and the camera. Scene titles and texts are translation keys under `atlasStory`
in `languageOverrides.json`, and the welcome message texts are under `welcomeMessage`. On the first visit
the story is offered after the welcome message is closed.

Check that every layer of the catalog can be loaded from its source (no dependencies, Node.js >= 22):

```bash
node scripts/check-catalog.mjs
```

The GitHub Actions workflow "Check catalog" runs the same check weekly and on pull requests that change
`wwwroot/init/`.

Catalog names and descriptions are written as translation keys, e.g. `"name": "translate#catalog.climate.zones"`,
with the texts under `catalog` in `wwwroot/languages/{en,hy,ru}/languageOverrides.json`. TerriaJS itself does not
translate catalog entries; `index.js` replaces the keys when the map loads and when the language changes.

Base maps are the `baseMaps` of `wwwroot/init/simple.json`: raster styles of [Stadia Maps](https://stadiamaps.com)
(the default is Alidade Smooth), then Bing imagery from Cesium ion, Natural Earth II and OpenStreetMap from TerriaJS.
Stadia authorises tile requests from maps.opendata.am by domain, as set in the Stadia account, and from localhost without
any authorisation, so the config has no API key. To serve the atlas under another domain, add the domain in the Stadia account.

The map opens in 3D with Cesium World Terrain. Terrain, Bing imagery and the 3D tiles of the group "3D: terrain and
buildings" (Google Photorealistic 3D Tiles, Cesium OSM Buildings) come from [Cesium ion](https://ion.cesium.com) with the
token `cesiumIonAccessToken` in `wwwroot/config.json`. Browsers send the token to Cesium ion, so it is public: keep it
limited to the read scopes (`assets:read`, `assets:limited-list`, `geocode`) and to the atlas URLs in the ion account.

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

### Population layers

The WorldPop raster and the Kontur hexagons are converted for the map by
`scripts/population/build.sh` (needs Docker for GDAL) and published as resources on data.opendata.am:

- [wdwp-49747](https://data.opendata.am/dataset/wdwp-49747): coloured RGBA Cloud Optimised GeoTIFF
  (TerriaJS cannot colour single-band COGs; the colours are in `scripts/population/population-colors.txt`
  and the legend of the `worldpop-2020` catalog item)
- [armenia-population-density-for-400m-h3-hexagons](https://data.opendata.am/dataset/armenia-population-density-for-400m-h3-hexagons):
  zipped GeoJSON

To rebuild them and replace the resources:

```bash
sh scripts/population/build.sh /tmp/population
curl -H "Authorization: $CKAN_API_TOKEN" -F id=521cd9e9-c80b-43ba-883a-1a11b4057eaa -F upload=@/tmp/population/worldpop_arm_2020_ppp_100m_rgba_cog.tif https://data.opendata.am/api/3/action/resource_update
curl -H "Authorization: $CKAN_API_TOKEN" -F id=0d94bf3b-d876-41e7-bd76-41ac56e27e26 -F upload=@/tmp/population/kontur_population_arm_h3_400m.geojson.zip https://data.opendata.am/api/3/action/resource_update
```

### Region mapping (choropleths by marz and Yerevan district)

A CSV with a column of marzes or Yerevan districts is shown as a choropleth without any configuration.
The column is recognised by its name and its values can be codes or names in English, Armenian or Russian:

| Region type            | Column names                                                                          | Values                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ARM_MARZ`             | `marz`, `province`, `region`, `adm1_pcode`, `adm1_en`, `մարզ`, `марз`, `область`, ... | ISO 3166-2 codes (`AM-ER`), OCHA P-codes (`AM01`), `Shirak`, `Շիրակի մարզ`, `Ширакская область`, `г. Ереван` |
| `ARM_YEREVAN_DISTRICT` | `district`, `yerevan_district`, `community_code`, `վարչական_շրջան`, `район`, ...      | codes `01-001` ... `01-012`, `Kentron`, `Կենտրոն վարչական շրջան`, `Кентрон район`                            |

The region types are defined in `wwwroot/data/regions/regionMapping.json`. Boundaries, vector tiles
and region id lists are built by (marzes from OpenStreetMap, districts from the Yerevan Municipality GIS):

```bash
cd scripts/regions && npm install && npm run build-marz && npm run build-yerevan-districts
```

The scripts overwrite their files in `wwwroot/data/regions/`; edit the spelling variants in
`scripts/regions/build-*.mjs`, not the generated files.

### Updating TerriaMap

Apply the upstream changes between the current and the new TerriaMap release, excluding
the files customised here, then review and resolve conflicts:

```bash
git clone https://github.com/TerriaJS/TerriaMap /tmp/TerriaMap
git -C /tmp/TerriaMap diff v0.4.8 <new-version> -- . ':!wwwroot/config.json' ':!wwwroot/init' ':!wwwroot/languages' ':!README.md' | git apply -3
```
