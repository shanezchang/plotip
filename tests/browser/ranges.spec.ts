import { test, expect, type Page } from "@playwright/test";

async function openRanges(page: Page, country = "US") {
  await page.goto("/");
  await page.getByRole("button", { name: "IP ranges", exact: true }).click();
  await expect(
    page.locator('#range-country option[value="country:US"]'),
  ).toBeAttached();
  await page.locator("#range-country").selectOption(`country:${country}`);
  await expect(page.locator(".range-row")).toHaveCount(20);
}
async function mapCenter(page: Page) {
  await page.locator("#map").scrollIntoViewIfNeeded();
  const map = (await page.locator("#map").boundingBox())!;
  const rail = (await page.locator(".rail").boundingBox())!;
  return {
    x: map.x + (rail.x + rail.width + 32 + map.width - 64) / 2,
    y: map.y + map.height / 2,
  };
}

test("map clicks select a country then a real state polygon", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "California", exact: false }).click();
  await expect(page.locator(".place-title")).toHaveText("California");
  const pin = (await page.locator(".map-pin.selected").boundingBox())!;
  await page.mouse.click(pin.x + pin.width / 2, pin.y + pin.height / 2 + 40);
  await expect(page.locator("#range-title")).toHaveText("United States");
  await expect(page.locator(".range-row")).toHaveCount(20);
  await page.locator("#map-level").selectOption("region");
  const center = await mapCenter(page);
  const response = page.waitForResponse(
    (r) => r.url().includes("/api/ranges?area=region") && r.status() === 200,
  );
  await page.mouse.click(center.x, center.y);
  const data = await (await response).json();
  expect(data.area.level).toBe("region");
  expect(data.area.country_code).toBe("US");
  await expect(page.locator("#range-title")).toHaveText(data.area.name);
  await page.screenshot({ path: ".cache/ranges-desktop.png" });
});

test("pagination, IPv6, exact CIDR copy and forward lookup form a loop", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await openRanges(page);
  const first = await page.locator(".range-address").first().innerText();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".range-pagination span")).toHaveText("21–40");
  expect(await page.locator(".range-address").first().innerText()).not.toBe(
    first,
  );
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".range-address").first()).toHaveText(first, {
    useInnerText: true,
  });
  await page.getByRole("button", { name: "IPv6", exact: true }).click();
  await expect(page.locator(".range-pagination span")).toHaveText("1–20");
  await expect(page.locator(".range-address").first()).toContainText(":");
  const row = page.locator(".range-row").first();
  await row.locator("summary").click();
  const cidrs = await row.locator("pre").innerText();
  const address = await row.locator("code").first().innerText();
  await row.getByRole("button", { name: "Copy CIDRs", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(cidrs);
  await row
    .getByRole("button", { name: "Look up first IP", exact: false })
    .click();
  await expect(page.locator("#workspace")).toHaveAttribute(
    "data-mode",
    "lookup",
  );
  await expect(page.locator(".result-ip")).toHaveText(address);
  expect(requests.some((url) => /\.(sqlite|xdb)/.test(url))).toBe(false);
});

test("empty states, Chinese language and request failure recovery", async ({
  page,
}) => {
  await openRanges(page, "UY");
  await page.locator("#range-region").selectOption("region:URY-8");
  await page.getByRole("button", { name: "IPv6", exact: true }).click();
  await expect(page.locator(".range-empty")).toContainText("No IPv6 ranges");
  await page.getByRole("button", { name: "切换到中文" }).click();
  await expect(page.locator(".range-empty")).toContainText("未记录");
  await page.route("**/api/ranges?**", (route) => route.abort());
  await page.getByRole("button", { name: "IPv4", exact: true }).click();
  await expect(page.locator(".range-status")).toContainText("暂时无法");
  await page.unroute("**/api/ranges?**");
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.locator(".range-status")).not.toContainText("暂时无法");
});

test("a slow previous area never replaces a newer selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "IP ranges", exact: true }).click();
  await expect(
    page.locator('#range-country option[value="country:US"]'),
  ).toBeAttached();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/ranges?**", async (route) => {
    if (
      new URL(route.request().url()).searchParams.get("area") === "country:US"
    ) {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response }).catch(() => {});
    } else await route.continue();
  });
  const pending = page.waitForRequest((r) =>
    r.url().includes("/api/ranges?area=country%3AUS"),
  );
  await page.locator("#range-country").selectOption("country:US");
  await pending;
  await page.locator("#range-country").selectOption("country:CN");
  await expect(page.locator("#range-title")).toHaveText("China");
  await expect(page.locator(".range-row")).toHaveCount(20);
  release();
  await page.getByRole("button", { name: "IPv6", exact: true }).click();
  await expect(page.locator(".range-address").first()).toContainText(":");
  await expect(page.locator("#range-title")).toHaveText("China");
});

for (const width of [320, 390])
  test(`reverse ranges at ${width}px in dark mode`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openRanges(page);
    await page.getByRole("button", { name: "Toggle color theme" }).click();
    await page.getByRole("button", { name: "IPv6", exact: true }).click();
    await expect(page.locator(".range-address").first()).toContainText(":");
    await page.locator(".range-row summary").first().click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
    await page.screenshot({
      path: `.cache/ranges-mobile-${width}.png`,
      fullPage: true,
    });
  });
