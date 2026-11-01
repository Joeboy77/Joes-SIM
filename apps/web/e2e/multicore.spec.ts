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

const RACE = `        LDA total
        ADD one
        STA total
        HLT
core1   LDA total
        ADD one
        STA total
        HLT
total   DAT 0
one     DAT 1`;

test.beforeEach(async ({ page }) => {
  await page.goto("/sim");
  await expect(page.locator(".cm-editor")).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
});

test("two cores lose an update, the race is marked, and manual order fixes it", async ({
  page,
}) => {
  await openSettings(page);
  await page.getByRole("combobox", { name: "Machine" }).selectOption("multicore");
  await page.getByLabel("Speed").selectOption("instant");
  await typeProgram(page, RACE);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(status(page)).toContainText("Finished after 8 instructions");
  await showTab(page, "Machine");
  await expect(page.getByRole("list", { name: "Cores", exact: true })).toContainText(
    "Kofi (core 0)",
  );
  await expect(
    page.getByRole("list", { name: "Timeline of cores" }).getByRole("button"),
  ).toHaveCount(8);
  await expect(page.getByRole("region", { name: "Multicore" })).toContainText("Mailbox 08 (total)");
  await expect(
    page.getByRole("button", { name: /^Mailbox 08 : 001 , label total .*race/ }),
  ).toBeVisible();

  // Manual: Kofi does the whole update, then Kwame: no update is lost.
  await page.getByLabel("Schedule").selectOption("manual");
  for (const core of [0, 0, 0, 0, 1, 1, 1, 1]) {
    await page
      .getByRole("button", { name: `Step ${core === 0 ? "Kofi (core 0)" : "Kwame (core 1)"}` })
      .click();
  }
  await expect(status(page)).toContainText("Finished after 8 instructions");
  await expect(page.getByRole("button", { name: /^Mailbox 08 : 002/ })).toBeVisible();

  await openSettings(page);
  await page.getByLabel("View", { exact: true }).selectOption("story");
  await expect(page.getByRole("img", { name: /Story view\. Kofi \(core 0\)/ })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("the order-of-cores challenge is solved by choosing an order", async ({ page }) => {
  await page.goto("/challenges/lost-update");
  await page.getByLabel("Order of cores").fill("0 1 0 1 0 1 0 1");
  await page.getByRole("button", { name: "Run the tests" }).click();
  await expect(page.getByText(/All 1 tests pass/)).toBeVisible();
});
