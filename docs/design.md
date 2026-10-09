# 落点 Plotip

An Explore / Inspect tool. Plot + IP: put an address on the map. The Chinese name 落点 expresses the same action. This is a product identity, not a claim of a legally exclusive name.

## Identity

The original SVG mark combines a three-panel folded map with a white location pin. Three flat blues describe the folds; the negative-space pin stays legible at favicon size. The lowercase Manrope wordmark is compact, with a quiet Chinese companion. Source: `web/public/plotip-mark.svg`; favicon uses the same geometry. No external logo assets.

## Visual system

Paper #f8f9fb; surface #ffffff; ink #252938; secondary text #606676; blue #315be8; water #e9edf5. Dark surfaces #1c202b / #272c3a; ink #edf0f8; accent #a4b7ff. No gradients or glass.

Manrope for interface/wordmark, PingFang SC for Chinese, IBM Plex Mono for IP addresses and coordinates. Keep the brand distinctive and the controls quiet. Result title and context carry geography once; only additional ISP information gets a detail row.

Desktop: a 76px header, a full-width map and a 344px floating query panel. Mobile: query, concise result, map, history. Reference: Apple Maps' persistent map workspace; Primer's keyboard focus and readable controls. Do not copy their identity.

The previous green full-height rail felt generic and repeated too much information. The revision gives the map the entire workspace, creates a real map-related mark, and removes duplicate result fields. No decorative feature cards or artificial dashboard metrics.

## Map behavior

- Markers must preserve MapLibre's absolute positioning; relative positioning shifts pins as history grows.
- Camera padding excludes the desktop query panel. `fitBounds` uses `absolutePadding: true` so existing padding does not accumulate, including after mobile resize.
- A regional lookup highlights that region, uses its extent for framing, and places a reference marker inside its main polygon. It does not claim device coordinates.
- Canonical administrative names outrank translated names and aliases. Ties are unresolved rather than overwritten by file order. Washington state and District of Columbia have separate mappings.
- The session-history key is versioned to discard cached coordinates from before the correction.
