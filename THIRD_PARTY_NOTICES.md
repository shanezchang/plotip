# Third-party data and software

IP Atlas application code is MIT-licensed. Third-party software and datasets keep their own licenses.

- **IP data and query engine:** [lionsoul2014/ip2region](https://github.com/lionsoul2014/ip2region), copyright Lionsoul / The Ip2Region Authors. Repository snapshot `02f04aa559acd954d94f77086e8ebe32483b365b`. The upstream repository declares `Apache-2.0 OR MIT`; its complete license is reproduced in `data/IP2REGION-LICENSE.txt`. We bundle the open-source XDB files, not the separate commercial database. Python binding `py-ip2region` is pinned in `uv.lock` and retains its upstream license.
- **City reference coordinates:** [GeoNames](https://www.geonames.org/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), through `geonamescache==3.0.2`. IP Atlas normalizes names, matches them to IP regions, and extracts coordinates into `data/places.json`. These are modified, incomplete extracts; they are not device locations. No endorsement by GeoNames is implied.
- **Map, region and country reference coordinates:** [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), public domain. Original country geometry and simplified administrative outlines; unused properties removed. Snapshot `ca96624a56bd078437bca8184e78163e5039ad19` from `nvkelso/natural-earth-vector`. Geographic names and boundaries follow upstream data.
- **Map renderer:** MapLibre GL JS, BSD-3-Clause. License in `web/public/licenses/MAPLIBRE-LICENSE.txt`.
- **Interface icons:** Lucide, ISC (some inherited icons under MIT). License in `web/public/licenses/LUCIDE-LICENSE.txt`.
- **Manrope and IBM Plex Mono fonts:** SIL Open Font License 1.1. License files in `web/public/licenses/`. Font files are served locally, not from a font CDN.

The website's About dialog attributes all geographic data sources. Distributed front-end dependency notices are also retained by the bundler.
