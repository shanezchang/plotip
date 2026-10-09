import { test, expect } from "@playwright/test";

test("IPv4 query updates real map, history, language and theme without shipping XDB", async ({
  page,
}) => {
  const errors: string[] = [];
  const urls: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => urls.push(r.url()));
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "南京", exact: false }).click();
  await expect(page.locator(".place-title")).toHaveText("南京市");
  await expect(page.locator(".map-pin.selected")).toHaveAttribute(
    "aria-label",
    /114\.114/,
  );
  await expect(page.locator(".location-note")).toContainText("城市中心");
  await expect(page.locator(".history-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.locator(".place-title")).toHaveText("Nanjing");
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(urls.some((u) => u.includes(".xdb"))).toBeFalsy();
  expect(errors).toEqual([]);
  await expect(page.locator(".place-title")).toHaveCSS(
    "color",
    "rgb(231, 240, 235)",
  );
});

test("IPv6 and region fallback do not claim device coordinates", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "深圳 · IPv6", exact: false }).click();
  await expect(page.locator(".place-title")).toHaveText("深圳市");
  await expect(page.locator(".version-badge")).toHaveText("IPv6");
  await page.getByRole("button", { name: "加利福尼亚", exact: false }).click();
  await expect(page.locator(".location-note")).toContainText("省 / 州参考位置");
  await expect(page.locator(".history-item")).toHaveCount(2);
  await page.locator(".history-item").nth(1).click();
  await expect(page.locator(".place-title")).toHaveText("深圳市");
  await page.getByRole("button", { name: "清空", exact: true }).click();
  await expect(page.locator(".history-item")).toHaveCount(0);
  await expect(page.locator(".map-pin")).toHaveCount(0);
});

test("invalid and non-public IPs remain understandable", async ({ page }) => {
  await page.goto("/");
  await page.locator("#ip-input").fill("not-an-ip");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("有效");
  await page.locator("#ip-input").fill("192.168.1.1");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await expect(page.locator(".place-title")).toHaveText("非公网地址");
  await expect(page.locator(".map-pin")).toHaveCount(0);
});

test("network errors recover and history survives reload only within session", async ({
  page,
}) => {
  await page.goto("/");
  await page.route("**/api/lookup", (route) => route.abort());
  await page.getByRole("button", { name: "南京", exact: false }).click();
  await expect(page.getByRole("alert")).toContainText("查询暂时失败");
  await expect(page.locator("#submit")).toBeEnabled();
  await page.unroute("**/api/lookup");
  await page.getByRole("button", { name: "南京", exact: false }).click();
  await expect(page.locator(".place-title")).toHaveText("南京市");
  await page.reload();
  await expect(page.locator(".history-item")).toHaveCount(1);
  await page.locator(".history-item").click();
  await expect(page.locator(".place-title")).toHaveText("南京市");
});

test("keyboard shortcut and accessible about dialog", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("/");
  await expect(page.locator("#ip-input")).toBeFocused();
  await page.getByRole("button", { name: "关于与数据来源" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "关于与数据来源" }),
  ).toBeFocused();
});

for (const width of [320, 390, 1440])
  test(`layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "深圳 · IPv6", exact: false })
      .click();
    await expect(page.locator(".place-title")).toHaveText("深圳市");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
    await page.screenshot({
      path: `.cache/screenshot-${width}.png`,
      fullPage: true,
    });
  });
