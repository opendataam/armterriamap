# armterriamap

TerriaJS based armenian community national map. Configuration and settings for maps.opendata.am

The repository is a fork of [TerriaMap](https://github.com/TerriaJS/TerriaMap) v0.4.8 (TerriaJS 8.13.0).
The application is built from source; compiled output (`wwwroot/build/`) is not stored in git.

## Repository layout

- `wwwroot/config.json` - map configuration (app name, languages, search, help)
- `wwwroot/init/simple.json` - data catalog
- `wwwroot/languages/<lng>/languageOverrides.json` - translations of the interface and map-specific texts
- `wwwroot/data/` - data files served with the map
- `wwwroot/about.html`, `wwwroot/help/`, `wwwroot/public/` - static pages
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

1. Upload data to `wwwroot/data` directory, it should be one of the supported data formats
2. Write new record to `wwwroot/init/simple.json` to add it to the public catalog

HotOSM layers are stored as zip archives in `wwwroot/data/hotosm/`; the Docker build unpacks them.
For local development run `sh unpack.sh` in that directory.

### Updating TerriaMap

Apply the upstream changes between the current and the new TerriaMap release, excluding
the files customised here, then review and resolve conflicts:

```bash
git clone https://github.com/TerriaJS/TerriaMap /tmp/TerriaMap
git -C /tmp/TerriaMap diff v0.4.8 <new-version> -- . ':!wwwroot/config.json' ':!wwwroot/init' ':!wwwroot/languages' ':!README.md' | git apply -3
```
