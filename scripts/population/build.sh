#!/bin/sh
# Builds the population layers of the atlas from sources on data.opendata.am:
#
#   worldpop_arm_2020_ppp_100m_rgba_cog.tif
#     WorldPop 2020 constrained population per ~100 m cell, coloured with
#     population-colors.txt as an RGBA Cloud Optimised GeoTIFF (TerriaJS cannot
#     colour single-band COGs itself).
#   kontur_population_arm_h3_400m.geojson.zip
#     Kontur population for 400 m H3 hexagons as GeoJSON in WGS 84, zipped
#     (TerriaJS reads zipped GeoJSON).
#
# The results are published as resources on data.opendata.am.
# Needs curl and Docker (for GDAL).
#
# usage: sh scripts/population/build.sh <output directory>
set -eu

OUT=$(cd "${1:?output directory}" && pwd)
HERE=$(cd "$(dirname "$0")" && pwd)
GDAL="docker run --rm -v $OUT:/out -v $HERE:/scripts:ro ghcr.io/osgeo/gdal:ubuntu-small-3.10.3"
CKAN=https://data.opendata.am/api/3/action

resource_url() {
  curl -sS "$CKAN/resource_show?id=$1" |
    python3 -c 'import json, sys; print(json.load(sys.stdin)["result"]["url"])'
}

# WorldPop: arm_ppp_2020_constrained.tif (dataset wdwp-49747)
curl -sSL -o "$OUT/arm_ppp_2020_constrained.tif" \
  "$(resource_url 39f2cb73-5a87-496c-8fd8-9f00a0d89ef0)"
$GDAL gdaldem color-relief -alpha -of GTiff \
  /out/arm_ppp_2020_constrained.tif /scripts/population-colors.txt /out/ppp_rgba.tif
$GDAL gdal_translate -of COG \
  -co COMPRESS=DEFLATE -co TILING_SCHEME=GoogleMapsCompatible \
  -co RESAMPLING=NEAREST -co OVERVIEW_RESAMPLING=AVERAGE \
  /out/ppp_rgba.tif /out/worldpop_arm_2020_ppp_100m_rgba_cog.tif
rm "$OUT/ppp_rgba.tif"

# Kontur: kontur_population_AM_20220630.gpkg.gz
# (dataset armenia-population-density-for-400m-h3-hexagons)
curl -sSL "$(resource_url 98e605b1-2fcc-44d5-8f17-3b154ea50af1)" |
  gunzip >"$OUT/kontur_population_AM.gpkg"
rm -f "$OUT/kontur_population_arm_h3_400m.geojson"
$GDAL ogr2ogr -f GeoJSON -t_srs EPSG:4326 -lco COORDINATE_PRECISION=5 \
  /out/kontur_population_arm_h3_400m.geojson /out/kontur_population_AM.gpkg population
(cd "$OUT" && rm -f kontur_population_arm_h3_400m.geojson.zip &&
  zip -q -9 kontur_population_arm_h3_400m.geojson.zip kontur_population_arm_h3_400m.geojson)

ls -l "$OUT"/worldpop_arm_2020_ppp_100m_rgba_cog.tif "$OUT"/kontur_population_arm_h3_400m.geojson.zip
