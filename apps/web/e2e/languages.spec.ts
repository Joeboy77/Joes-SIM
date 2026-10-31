import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("choosing a right-to-left language mirrors the page and is remembered", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.getByLabel("Language").selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  // Not translated yet, so the text stays English rather than going blank.
  await expect(page.getByRole("link", { name: "Simulator", exact: true }).first()).toBeVisible();
  await page.goto("/sim");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await page.goto("/");
  await page.getByLabel("Language").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});
