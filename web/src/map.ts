import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, LineString } from "geojson";
import type { Result, Lang } from "./types";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);

const grid: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [],
};
for (let x = -180; x <= 180; x += 30)
  grid.features.push({
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [x, -85],
        [x, 85],
      ],
    },
  });
for (let y = -60; y <= 60; y += 30)
  grid.features.push({
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: Array.from({ length: 37 }, (_, i) => [-180 + i * 10, y]),
    },
  });

export class AtlasMap {
  private map?: maplibregl.Map;
  private markers: maplibregl.Marker[] = [];
  private labels: {
    marker: maplibregl.Marker;
    zh: string;
    en: string;
    rank: number;
  }[] = [];
  private results: Result[] = [];
  private active?: Result;
  private lang: Lang = "zh";
  private ready = false;
  private dark = false;
  constructor(private onSelect: (r: Result) => void) {}
  async init(dark: boolean) {
    this.dark = dark;
    try {
      const response = await fetch("/world.geojson");
      if (!response.ok) throw new Error("Map unavailable");
      const world = await response.json();
      const style: StyleSpecification = {
        version: 8,
        transition: { duration: 0, delay: 0 },
        sources: {
          regions: { type: "geojson", data: "/regions.geojson" },
          world: { type: "geojson", data: world },
          grid: { type: "geojson", data: grid },
          active: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        layers: [
          {
            id: "water",
            type: "background",
            paint: { "background-color": "#e5eeeb" },
          },
          {
            id: "grid",
            type: "line",
            source: "grid",
            paint: {
              "line-color": "#b7cac3",
              "line-width": 0.6,
              "line-opacity": 0.45,
              "line-dasharray": [2, 5],
            },
          },
          {
            id: "land",
            type: "fill",
            source: "world",
            paint: { "fill-color": "#fbfcf8" },
          },
          {
            id: "borders",
            type: "line",
            source: "world",
            paint: { "line-color": "#b7cac3", "line-width": 0.65 },
          },
          {
            id: "regions",
            type: "line",
            source: "regions",
            minzoom: 2.5,
            paint: {
              "line-color": "#b7cac3",
              "line-width": 0.65,
              "line-opacity": 0.65,
            },
          },
          {
            id: "selected",
            type: "fill",
            source: "world",
            filter: ["==", ["get", "code"], ""],
            paint: { "fill-color": "#176657", "fill-opacity": 0.13 },
          },
          {
            id: "selected-outline",
            type: "line",
            source: "world",
            filter: ["==", ["get", "code"], ""],
            paint: {
              "line-color": "#176657",
              "line-width": 1.1,
              "line-opacity": 0.7,
            },
          },
        ],
      };
      this.map = new maplibregl.Map({
        container: "map",
        style,
        center: [65, 24],
        zoom: 1.25,
        minZoom: 0.6,
        maxZoom: 5.5,
        renderWorldCopies: false,
        attributionControl: false,
        dragRotate: false,
        touchPitch: false,
        pitchWithRotate: false,
        canvasContextAttributes: { antialias: true },
      });
      this.map.touchZoomRotate.disableRotation();
      this.map.on("load", () => {
        this.ready = true;
        for (const f of world.features) {
          const p = f.properties;
          if (p.rank > 5 || p.code === "AQ") continue;
          const zh =
            p.code?.length === 2
              ? new Intl.DisplayNames(["zh"], { type: "region" }).of(p.code) ||
                p.zh
              : p.zh;
          const en =
            p.code?.length === 2
              ? new Intl.DisplayNames(["en"], { type: "region" }).of(p.code) ||
                p.name
              : p.name;
          const label = document.createElement("span");
          label.className = "country-label";
          label.textContent = this.lang === "zh" ? zh : en;
          const marker = new maplibregl.Marker({ element: label })
            .setLngLat([p.lon, p.lat])
            .addTo(this.map!);
          this.labels.push({ marker, zh, en, rank: p.rank });
        }
        this.theme(this.dark);
        this.updateLabels();
        this.render();
        if (this.active?.location) this.focus(this.active);
        document.getElementById("map-loading")!.hidden = true;
        document.getElementById("map")!.dataset.ready = "true";
      });
      this.map.on("zoom", () => this.updateLabels());
      this.map.on("mousemove", (event) => {
        document.getElementById("map-coordinates")!.textContent =
          `${Math.abs(event.lngLat.lat).toFixed(1)}° ${event.lngLat.lat >= 0 ? "N" : "S"}   ${Math.abs(event.lngLat.lng).toFixed(1)}° ${event.lngLat.lng >= 0 ? "E" : "W"}`;
      });
      this.map.on("error", () => this.failure());
      document.getElementById("zoom-in")!.onclick = () => this.map?.zoomIn();
      document.getElementById("zoom-out")!.onclick = () => this.map?.zoomOut();
      document.getElementById("reset-map")!.onclick = () => this.overview();
    } catch {
      this.failure();
    }
  }
  private failure() {
    const el = document.getElementById("map-loading")!;
    el.hidden = false;
    el.textContent =
      this.lang === "zh"
        ? "地图暂时无法显示，仍可查询 IP。"
        : "Map unavailable. IP lookup still works.";
  }
  private updateLabels() {
    const z = this.map?.getZoom() ?? 1;
    this.labels.forEach((x) => {
      x.marker.getElement().style.display =
        x.rank <= (z < 1.7 ? 2 : z < 2.5 ? 3 : 5) ? "" : "none";
    });
  }
  language(lang: Lang) {
    this.lang = lang;
    this.labels.forEach(
      (x) => (x.marker.getElement().textContent = lang === "zh" ? x.zh : x.en),
    );
    this.render();
  }
  theme(dark: boolean) {
    this.dark = dark;
    if (!this.ready || !this.map) return;
    for (const [id, prop, color] of [
      ["water", "background-color", dark ? "#142b29" : "#e5eeeb"],
      ["land", "fill-color", dark ? "#29413a" : "#fbfcf8"],
      ["borders", "line-color", dark ? "#486259" : "#b7cac3"],
      ["regions", "line-color", dark ? "#486259" : "#b7cac3"],
      ["grid", "line-color", dark ? "#527369" : "#b7cac3"],
      ["selected", "fill-color", dark ? "#95c9b7" : "#176657"],
      ["selected-outline", "line-color", dark ? "#95c9b7" : "#176657"],
    ])
      this.map.setPaintProperty(
        id,
        prop as "background-color" | "fill-color" | "line-color",
        color,
      );
  }
  update(results: Result[], active?: Result, fly = true) {
    this.results = results;
    this.active = active;
    this.render();
    if (fly && active?.location && this.ready) this.focus(active);
    else if (fly && active && !active.location) this.overview();
  }
  private focus(r: Result) {
    if (!r.location) return;
    this.map?.flyTo({
      center: [r.location.longitude, r.location.latitude],
      zoom:
        r.location.level === "city"
          ? 4.2
          : r.location.level === "region"
            ? 3.1
            : 2.1,
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 650,
    });
  }
  overview() {
    this.map?.flyTo({
      center: [65, 24],
      zoom: 1.25,
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 450,
    });
  }
  private render() {
    if (!this.ready || !this.map) return;
    this.markers.forEach((m) => m.remove());
    this.markers = [];
    for (const r of [...this.results].reverse()) {
      if (!r.location) continue;
      const selected = r.ip === this.active?.ip;
      const button = document.createElement("button");
      button.className = `map-pin${selected ? " selected" : ""}`;
      button.setAttribute(
        "aria-label",
        `${r.ip} · ${r.city || r.region || r.country}`,
      );
      const dot = document.createElement("span");
      dot.className = "pin-dot";
      button.append(dot);
      if (selected) {
        const label = document.createElement("span");
        label.className = "pin-label";
        label.textContent =
          this.lang === "en"
            ? r.location.name
            : (r.location.level === "city"
                ? r.city
                : r.location.level === "region"
                  ? r.region
                  : r.country) || r.location.name;
        button.append(label);
      }
      button.onclick = () => this.onSelect(r);
      this.markers.push(
        new maplibregl.Marker({ element: button, anchor: "center" })
          .setLngLat([r.location.longitude, r.location.latitude])
          .addTo(this.map),
      );
    }
    for (const layer of ["selected", "selected-outline"])
      this.map.setFilter(layer, [
        "==",
        ["get", "code"],
        this.active?.location ? this.active.country_code || "" : "",
      ]);
  }
}
