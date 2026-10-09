import type { Area, Lang, RangePage } from "./types";

const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const words = {
  en: {
    title: "Explore IP ranges",
    hint: "Click the map or choose a place.",
    country: "Country / territory",
    region: "State / province",
    choose: "Choose a country",
    whole: "Entire country",
    loading: "Loading ranges…",
    failed: "Ranges could not be loaded.",
    retry: "Try again",
    empty: "No IPv{v} ranges recorded for this area.",
    emptyHint: "Try the other IP version or the entire country.",
    note: "Database attribution, not live devices or exact locations.",
    previous: "Previous",
    next: "Next",
    ranges: "ranges",
    copy: "Copy CIDRs",
    copied: "CIDRs copied",
    copyFailed: "Could not copy. Select the CIDRs manually.",
    details: "Details & CIDRs",
    start: "Start",
    end: "End",
    inspect: "Look up first IP",
    network: "Network",
    noNetwork: "Network not recorded",
    place: "Recorded locality",
    addresses: "addresses",
    entire: "View entire country",
    countriesError: "Place list unavailable. You can still select the map.",
    source: "Source",
    select: "Select a place on the map to see its recorded IP ranges.",
  },
  zh: {
    title: "按地区查 IP 段",
    hint: "点击地图，或选择一个地区。",
    country: "国家 / 地区",
    region: "省 / 州",
    choose: "选择国家 / 地区",
    whole: "整个国家 / 地区",
    loading: "正在读取 IP 段…",
    failed: "暂时无法读取 IP 段。",
    retry: "重试",
    empty: "数据库未记录该地区的 IPv{v} 地址段。",
    emptyHint: "可以切换 IP 版本，或查看整个国家 / 地区。",
    note: "仅代表数据库归属记录，不代表在线设备或精确位置。",
    previous: "上一页",
    next: "下一页",
    ranges: "条 IP 段",
    copy: "复制 CIDR",
    copied: "已复制 CIDR",
    copyFailed: "未能复制，请手动选择 CIDR。",
    details: "详情与 CIDR",
    start: "起始",
    end: "结束",
    inspect: "查询首个 IP",
    network: "运营商",
    noNetwork: "未记录运营商",
    place: "记录地域",
    addresses: "个地址",
    entire: "查看整个国家 / 地区",
    countriesError: "地区列表暂时不可用，仍可在地图上选择。",
    source: "来源",
    select: "在地图上选择地区，查看数据库记录的 IP 范围。",
  },
};
export const areaName = (area: Area, lang: Lang) => {
  if (area.level === "country")
    return (
      new Intl.DisplayNames([lang], { type: "region" }).of(area.country_code) ||
      area.name
    );
  return lang === "zh" ? area.zh || area.name : area.name;
};

export class RangePanel {
  private lang: Lang = "en";
  private area?: Area;
  private version: 4 | 6 = 4;
  private page?: RangePage;
  private cursors = [0];
  private countries: Area[] = [];
  private regions: Area[] = [];
  private regionCountry = "";
  private active = false;
  private loading = false;
  private error = false;
  private catalogError = false;
  private request?: AbortController;
  private catalogRequest?: AbortController;
  constructor(
    private root: HTMLElement,
    private onArea: (area: Area) => void,
    private onLookup: (ip: string) => void,
    private toast: (message: string) => void,
  ) {}
  private t() {
    return words[this.lang];
  }
  language(lang: Lang) {
    this.lang = lang;
    this.render();
  }
  async open(area?: Area) {
    this.active = true;
    if (area && area.id !== this.area?.id) {
      this.area = area;
      this.cursors = [0];
      this.page = undefined;
      this.onArea(area);
      void this.fetchPage();
    } else if (this.area) {
      this.onArea(this.area);
      if (!this.page) void this.fetchPage();
    }
    this.render();
    void this.loadCatalog();
  }
  suspend() {
    this.active = false;
    this.request?.abort();
    this.request = undefined;
    this.catalogRequest?.abort();
    this.loading = false;
  }
  private async loadCatalog() {
    this.catalogRequest?.abort();
    const controller = new AbortController();
    this.catalogRequest = controller;
    const country = this.area?.country_code;
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      if (!this.countries.length) {
        const response = await fetch("/api/areas", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("catalog");
        const data = await response.json();
        if (controller !== this.catalogRequest || !this.active) return;
        this.countries = data.items;
      }
      if (country && country !== this.regionCountry) {
        const response = await fetch(`/api/areas?country=${country}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("catalog");
        const data = await response.json();
        if (controller !== this.catalogRequest || !this.active) return;
        this.regions = data.items;
        this.regionCountry = country;
      }
      this.catalogError = false;
    } catch {
      if (controller !== this.catalogRequest || !this.active) return;
      this.catalogError = true;
    } finally {
      clearTimeout(timer);
      if (controller === this.catalogRequest && this.active) this.render();
    }
  }
  private async fetchPage() {
    if (!this.area) return;
    const focused = this.root.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).id
      : "";
    this.request?.abort();
    const controller = new AbortController();
    this.request = controller;
    this.loading = true;
    this.error = false;
    this.page = undefined;
    this.render();
    const params = new URLSearchParams({
      area: this.area.id,
      version: String(this.version),
      after: String(this.cursors.at(-1)),
    });
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`/api/ranges?${params}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("ranges");
      const data: RangePage = await response.json();
      if (controller !== this.request || !this.active) return;
      this.page = data;
      this.area = data.area;
    } catch {
      if (controller !== this.request || !this.active) return;
      this.error = true;
    } finally {
      clearTimeout(timer);
      if (controller === this.request && this.active) {
        this.loading = false;
        this.render();
        if (focused && document.activeElement === document.body)
          document.getElementById(focused)?.focus({ preventScroll: true });
      }
    }
  }
  private render() {
    const t = this.t();
    const focused = this.root.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).id
      : "";
    const country = this.area?.country_code;
    const countries = [...this.countries].sort((a, b) =>
      areaName(a, this.lang).localeCompare(areaName(b, this.lang), this.lang),
    );
    const regions = this.regionCountry === country ? this.regions : [];
    const pageIndex = this.cursors.length - 1;
    this.root.innerHTML = `
      <div class="ranges-intro"><h1>${t.title}</h1><p>${t.hint}</p></div>
      <div class="area-fields"><label for="range-country">${t.country}</label><select id="range-country"><option value="">${t.choose}</option>${countries.map((a) => `<option value="${escape(a.id)}" ${a.country_code === country ? "selected" : ""}>${escape(areaName(a, this.lang))}</option>`).join("")}</select>
      ${country ? `<label for="range-region">${t.region}</label><select id="range-region" ${regions.length ? "" : "disabled"}><option value="">${t.whole}</option>${regions.map((a) => `<option value="${escape(a.id)}" ${a.id === this.area?.id ? "selected" : ""}>${escape(areaName(a, this.lang))}</option>`).join("")}</select>` : ""}
      ${this.catalogError ? `<p class="range-error">${t.countriesError} <button id="catalog-retry" class="text-button">${t.retry}</button></p>` : ""}</div>
      ${
        this.area
          ? `<div class="range-heading"><h2 id="range-title">${escape(areaName(this.area, this.lang))}</h2>${this.area.level === "region" ? `<button id="entire-country" class="text-button">${escape(new Intl.DisplayNames([this.lang], { type: "region" }).of(country!))} ↗</button>` : ""}</div>
      <div class="version-switch" role="group" aria-label="IP version"><button id="range-v4" aria-pressed="${this.version === 4}">IPv4</button><button id="range-v6" aria-pressed="${this.version === 6}">IPv6</button></div>
      <p class="range-disclaimer">${t.note}</p>
      <div class="range-status" role="status">${this.loading ? t.loading : this.error ? t.failed : this.page ? `${this.page.total_ranges.toLocaleString(this.lang)} ${t.ranges}` : ""}</div>
      ${this.error ? `<button id="range-retry" class="secondary">${t.retry}</button>` : ""}
      ${this.page ? this.renderPage() : ""}`
          : `<p class="range-empty">${t.select}</p>`
      }`;
    const get = <T extends HTMLElement>(id: string) =>
      this.root.querySelector<T>(`#${id}`);
    get<HTMLSelectElement>("range-country")!.onchange = (e) => {
      const area = this.countries.find(
        (a) => a.id === (e.target as HTMLSelectElement).value,
      );
      if (area) void this.open(area);
    };
    const region = get<HTMLSelectElement>("range-region");
    if (region)
      region.onchange = () => {
        const area =
          this.regions.find((a) => a.id === region.value) ||
          this.countries.find((a) => a.country_code === country);
        if (area) void this.open(area);
      };
    for (const version of [4, 6] as const) {
      const button = get<HTMLButtonElement>(`range-v${version}`);
      if (button)
        button.onclick = () => {
          if (this.version === version) return;
          this.version = version;
          this.cursors = [0];
          void this.fetchPage();
        };
    }
    const retry = get<HTMLButtonElement>("range-retry");
    if (retry) retry.onclick = () => void this.fetchPage();
    const catalogRetry = get<HTMLButtonElement>("catalog-retry");
    if (catalogRetry) catalogRetry.onclick = () => void this.loadCatalog();
    const entire = get<HTMLButtonElement>("entire-country");
    if (entire)
      entire.onclick = () => {
        const area = this.countries.find((a) => a.country_code === country);
        if (area) void this.open(area);
      };
    const previous = get<HTMLButtonElement>("range-prev");
    if (previous)
      previous.onclick = () => {
        if (pageIndex > 0) {
          this.cursors.pop();
          void this.fetchPage();
        }
      };
    const next = get<HTMLButtonElement>("range-next");
    if (next)
      next.onclick = () => {
        if (this.page?.next_cursor) {
          this.cursors.push(this.page.next_cursor);
          void this.fetchPage();
        }
      };
    this.root.querySelectorAll<HTMLButtonElement>("[data-copy-range]").forEach(
      (button) =>
        (button.onclick = async () => {
          const item = this.page?.items[Number(button.dataset.copyRange)];
          if (!item) return;
          try {
            await navigator.clipboard.writeText(item.cidrs.join("\n"));
            this.toast(t.copied);
          } catch {
            this.toast(t.copyFailed);
          }
        }),
    );
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-inspect-range]")
      .forEach(
        (button) =>
          (button.onclick = () => {
            const item = this.page?.items[Number(button.dataset.inspectRange)];
            if (item) this.onLookup(item.start);
          }),
      );
    if (focused) get<HTMLElement>(focused)?.focus({ preventScroll: true });
  }
  private renderPage() {
    const t = this.t(),
      page = this.page!;
    if (!page.items.length)
      return `<p class="range-empty">${t.empty.replace("{v}", String(this.version))}<span>${t.emptyHint}</span></p>`;
    const number = (this.cursors.length - 1) * 20;
    return `<div class="range-list">${page.items
      .map(
        (item, i) => `<article class="range-row">
      <div class="range-address"><code>${escape(item.start)}</code><span>–</span><code>${escape(item.end)}</code></div>
      <p class="range-network">${escape(item.isp || t.noNetwork)}</p>
      <details><summary>${t.details} <span>${item.cidrs.length}</span></summary><dl><dt>${t.place}</dt><dd>${escape([item.region, item.city].filter(Boolean).join(" / ") || areaName(page.area, this.lang))}</dd><dt>${t.addresses}</dt><dd>${BigInt(item.address_count).toLocaleString(this.lang)}</dd></dl><pre>${escape(item.cidrs.join("\n"))}</pre><div class="range-actions"><button data-copy-range="${i}">${t.copy}</button><button data-inspect-range="${i}">${t.inspect} ↗</button></div></details>
    </article>`,
      )
      .join(
        "",
      )}</div><div class="range-pagination"><button id="range-prev" class="text-button" ${this.cursors.length === 1 ? "disabled" : ""}>${t.previous}</button><span>${number + 1}–${number + page.items.length}</span><button id="range-next" class="text-button" ${page.next_cursor === null ? "disabled" : ""}>${t.next}</button></div><p class="range-source">${t.source}: ip2region · ${escape(page.data_version)}</p>`;
  }
}
