import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/compiler");
  await expect(page.getByRole("textbox", { name: "Little Language program" })).toBeVisible();
});

test("a Little Language program compiles, maps line by line and runs", async ({ page }) => {
  const editor = page.getByRole("textbox", { name: "Little Language program" });
  await editor.fill("input n\nprint n + 1\n");
  const lmc = page.getByRole("region", { name: "Generated LMC" });
  await expect(lmc).toContainText("// 2: print n + 1");
  await expect(lmc).toContainText("ADD  one");

  // Selecting a generated instruction selects its source line.
  await lmc.getByRole("button", { name: /^ADD one/ }).click();
  await expect(lmc.getByRole("button", { name: /^ADD one/ })).toHaveClass(/bg-branch/);

  await page.getByLabel("Speed").selectOption("instant");
  await page.getByLabel(/Values for INP to read/).fill("41");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("list", { name: "Output values" })).toHaveText("042");

  // Stepping highlights the running instruction.
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(lmc.locator('[aria-current="step"]')).toContainText("INP");

  await page.getByLabel("Optimise").check();
  await expect(page.getByText(/instructions with optimisation/)).toBeVisible();

  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("compile errors are explained in plain language", async ({ page }) => {
  await page.getByRole("textbox", { name: "Little Language program" }).fill("while x > 0\nend\n");
  await expect(
    page.getByRole("region", { name: "Generated LMC" }).getByRole("alert"),
  ).toContainText("'while' needs 'do' after its condition.");
});
