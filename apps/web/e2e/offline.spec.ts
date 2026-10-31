import { expect, test, type Page } from "@playwright/test";
import LZString from "lz-string";

/** Waits until the service worker has cached every page (it does so when it installs). */
async function installed(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(
    async () =>
      !!(await caches.match("/learn/arrays")) &&
      !!(await caches.match("/challenges/gcd")) &&
      !!(await caches.match("/embed")) &&
      !!(await caches.match("/packs/view")),
    undefined,
    { timeout: 60_000, polling: 500 },
  );
}

async function typeProgram(page: Page, source: string) {
  const content = page.locator(".cm-content").first();
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await content.fill(source);
}

test("after one visit, every part of the app works with the network off", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await installed(page);
  await context.setOffline(true);

  // A lesson never opened before, with its live simulator.
  await page.goto("/learn/arrays");
  await expect(
    page.getByRole("heading", { level: 1, name: "Arrays and self-modifying code" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run", exact: true }).first().click();

  // A challenge, with its tests run in the browser.
  await page.goto("/challenges/echo");
  await typeProgram(page, "        INP\n        OUT\n        HLT");
  await page.getByRole("button", { name: "Run the tests" }).click();
  await expect(page.getByText(/All 3 tests pass/)).toBeVisible();
  await expect(page.getByText("✓ Solved")).toBeVisible(); // saved on the device

  // A share link.
  const p = LZString.compressToEncodedURIComponent(
    JSON.stringify({
      v: 1,
      s: "        INP\n        OUT\n        HLT\n// offline link",
      d: "ocr",
      i: "4",
    }),
  );
  await page.goto(`/sim?p=${p}`);
  await expect(page.locator(".cm-content")).toContainText("// offline link");

  // The embed, a teacher pack, the reference, the docs and progress.
  await page.goto(
    `/embed?program=${encodeURIComponent("        INP\n        OUT\n        HLT")}&inputs=6`,
  );
  const settings = page.getByRole("button", { name: "Speed, dialect and view" });
  if (await settings.isVisible()) await settings.click();
  await page.getByLabel("Speed").selectOption("instant");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("list", { name: "Output values" })).toHaveText("006");
  await page.goto("/packs/view?id=dcit-207");
  await expect(page.getByRole("heading", { level: 1, name: /DCIT 207/ })).toBeVisible();
  await page.goto("/reference");
  await expect(
    page.getByRole("heading", { level: 1, name: "Instruction reference" }),
  ).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText(/1 of \d+ solved/)).toBeVisible();
  await context.setOffline(false);
});

test("a new version waits, and the learner chooses when to reload", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await installed(page);
  await page.reload(); // now controlled by the service worker
  // Simulate a new deploy: a different worker script for the same scope.
  await page.evaluate(() => navigator.serviceWorker.register("/sw.js?next"));
  const prompt = page
    .getByRole("status")
    .filter({ hasText: "A new version of Joe's SIM is ready" });
  await expect(prompt).toBeVisible({ timeout: 60_000 });
  const reloaded = page.waitForEvent("load");
  await prompt.getByRole("button", { name: "Reload" }).click();
  await reloaded;
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
