import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/", heading: /See what a computer is doing/ },
  { path: "/sim", heading: "Simulator" },
  { path: "/embed", heading: "Joe's SIM" },
];
const THEMES = ["light", "dark", "high-contrast"] as const;

for (const { path, heading } of PAGES) {
  test(`${path} loads`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  });

  for (const theme of THEMES) {
    test(`${path} has no accessibility violations in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("joes-sim:theme", t), theme);
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
