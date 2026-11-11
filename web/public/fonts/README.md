# Plotip fonts

Maple Mono 7.900 is shared by `--font-ui` and `--font-mono`: headings, controls,
short prose, numbers, IP addresses, range details, country labels and pin labels.
The existing `document.fonts.ready` map-label remeasurement remains in place.

- `maple-latin.woff2`: unmodified [official variable WOFF2](https://github.com/subframe7536/maple-font/blob/v7.9/woff2/var/MapleMono%5Bwght%5D-VF.woff2), 100–800.
- `maple-cn-{ui,places}-{400,500,600,700}.woff2`: subsets of four upright TTFs from [official v7.9 CN unhinted](https://github.com/subframe7536/maple-font/releases/download/v7.9/MapleMono-CN-unhinted.zip).
- Copyright 2022 The Maple Mono Project Authors. [SIL OFL 1.1](OFL-Maple.txt), no Reserved Font Name specified. CN subsetting/container conversion retains font naming, copyright and license metadata.

`manifest.json` records source/output SHA-256, sizes and exact codepoints. The
1,248 CJK codepoints come from Plotip's TS/HTML, world/region GeoJSON, bundled
place names and actual Chinese `Intl.DisplayNames` country names. The 474-codepoint
UI shard and the remaining place-name shard use disjoint `unicode-range` values.
This vocabulary is independent of Loupe and the résumé. U+FF0D is unavailable in
the official CN faces; unknown/dynamic names and unsupported scripts/IPA retain
system fallback. The Latin face itself includes supported extended Latin/IPA.

Total WOFF2 on disk is 1,427,772 bytes; browsers only request needed shards/weights.
Only the 130,908-byte Latin face is preloaded. Every face uses `font-display:swap`,
no `local()` source or CDN, so slow/failed downloads remain readable.
No desktop TTF, Nerd Font archive or build-time generation ships to the website.

To regenerate from the verified official originals (not subsets):

```sh
uv run scripts/subset_maple.py --source-dir /path/to/MapleMono-CN-unhinted
npx --no-install prettier --write web/src/fonts.css
```

The generator pins fontTools, asserts original SHA-256 and version/weight metadata,
and creates WOFF2, CSS and the manifest. Run it after adding Chinese UI/place text.
