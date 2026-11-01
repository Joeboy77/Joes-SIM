import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const status = (page: Page) => page.getByRole("status").first();

async function openSettings(page: Page) {
  const gear = page.getByRole("button", { name: "Speed, machine, dialect and view" });
  if ((await gear.isVisible()) && (await gear.getAttribute("aria-expanded")) !== "true")
    await gear.click();
}

async function showTab(page: Page, name: string) {
  const tab = page
    .getByRole("navigation", { name: "Simulator panels" })
    .getByRole("button", { name, exact: true });
  if (await tab.isVisible()) await tab.click();
}

async function typeProgram(page: Page, source: string) {
  await showTab(page, "Code");
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await page.locator(".cm-content").fill(source);
}

const LOOP = `        LDA n
loop    SUB one
        BRP loop
        HLT
n       DAT 4
one     DAT 1`;

/** Waits for fades and slides to finish, so contrast is checked on the final colours. */
async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  await page.waitForTimeout(400);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/sim");
  await expect(page.locator(".cm-editor")).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
});

test("the pipeline view counts cycles and stalls, and forwarding changes them", async ({
  page,
}) => {
  await openSettings(page);
  await page.getByRole("combobox", { name: "Machine" }).selectOption("extended");
  await page.getByLabel("Speed").selectOption("instant");
  await page.getByLabel("View", { exact: true }).selectOption("pipeline");
  await typeProgram(page, LOOP);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText(/Finished after 12 instructions/)).toBeVisible();
  await showTab(page, "Machine");
  const figures = page.getByLabel("Pipeline figures");
  await expect(figures).toContainText("29");
  await page.getByRole("button", { name: "Branch prediction" }).click();
  await expect(figures).toContainText("25");
  await page.getByRole("button", { name: "Forwarding" }).click();
  await expect(figures).not.toContainText("25");
  await expect(page.getByRole("table", { name: /Pipeline diagram/ })).toBeVisible();
  await page.getByRole("button", { name: "Previous clock cycle" }).click();
  await expect(page.getByRole("region", { name: /Pipeline stages in clock cycle/ })).toBeVisible();
  await settled(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("the cache view splits each address and counts hits", async ({ page }) => {
  await openSettings(page);
  await page.getByLabel("Speed").selectOption("instant");
  await page.getByLabel("View", { exact: true }).selectOption("cache");
  await typeProgram(page, LOOP);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(status(page)).toContainText("Finished");
  await showTab(page, "Machine");
  await expect(page.getByText("Hit rate")).toBeVisible();
  await expect(page.getByRole("table", { name: "Cache contents" })).toBeVisible();
  await page.getByRole("button", { name: "Step back one instruction" }).click();
  await page.getByRole("button", { name: "Step back one instruction" }).click();
  await expect(page.getByLabel("Address split into fields")).toBeVisible();
  await page.getByLabel("Sets").selectOption("1");
  await expect(page.getByText(/fully associative cache holding/)).toBeVisible();
  await settled(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("a cache challenge is solved by choosing the cache", async ({ page }) => {
  await page.goto("/challenges/pick-a-cache");
  await page.getByRole("button", { name: "Run the tests" }).click();
  await expect(page.getByText(/not the goal yet/)).toBeVisible();
  await page.getByLabel("Block").selectOption("2");
  await page.getByLabel("Sets").selectOption("2");
  await page.getByLabel("Ways").selectOption("2");
  await page.getByRole("button", { name: "Run the tests" }).click();
  await expect(page.getByText(/the goal is met/)).toBeVisible();
});
