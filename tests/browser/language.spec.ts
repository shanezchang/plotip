import { test, expect } from "@playwright/test";

test("new visitors see English and language choices persist", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("Plotip — IP lookup & ranges");
  await expect(page.locator("#header-caption")).toHaveText(
    "IP lookup & ranges",
  );
  await expect(
    page.getByRole("button", { name: "Look up", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".brand-chinese")).toBeHidden();
  await expect(page.locator(".github-link")).toHaveAttribute(
    "href",
    "https://github.com/shanezchang/plotip",
  );
  await page.getByRole("button", { name: "切换到中文" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator(".brand-chinese")).toBeVisible();
  await page.getByRole("button", { name: "Switch to English" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
