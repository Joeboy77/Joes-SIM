import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const status = (page: Page) => page.getByRole("status");

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

// Timer interrupts count on the seven-segment display and paint pixels; keys are echoed to the
// console. Phase 6 acceptance: draw on the pixel display, read the keyboard, respond to the timer.
const PROGRAM = `        VEC h
        LDA period
        PUT 20
        EI
idle    WAIT
        BRA idle
h       GET 50
        SUB one
        BRZ tick
        GET 2
        PUT 1
        RTI
tick    LDA count
        ADD one
        STA count
        PUT 30
        PUT 10
        LDA colour
        PUT 11
        RTI
period  DAT 20
count   DAT 0
one     DAT 1
colour  DAT 14`;

/** Waits until IndexedDB holds a file for the extended machine whose source contains `text`. */
async function savedExtended(page: Page, text: string) {
  await expect
    .poll(() =>
      page.evaluate(
        (t) =>
          new Promise<boolean>((resolve) => {
            const r = indexedDB.open("joes-sim");
            r.onsuccess = () => {
              const all = r.result.transaction("files").objectStore("files").getAll();
              all.onsuccess = () =>
                resolve(
                  (all.result as { source: string; machine?: string }[]).some(
                    (f) => f.source.includes(t) && f.machine === "extended",
                  ),
                );
            };
            r.onerror = () => resolve(false);
          }),
        text,
      ),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/sim");
  await expect(page.locator(".cm-editor")).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
});

test("a program draws on the pixel display, reads the keyboard and responds to the timer", async ({
  page,
}) => {
  await openSettings(page);
  await page.getByRole("combobox", { name: "Machine" }).selectOption("extended");
  await page.getByLabel("Speed").selectOption("fast");
  await typeProgram(page, PROGRAM);
  await expect(status(page)).toContainText("Ready");

  await page.getByRole("button", { name: "Run", exact: true }).click();
  await showTab(page, "Machine");
  const display = page.getByRole("img", { name: /Pixel display/ });
  await expect(display).toHaveAttribute("aria-label", /3 pixels lit|[4-9] of 256|1\d of 256/, {
    timeout: 20_000,
  });
  await expect(page.getByRole("img", { name: /Seven-segment display: [1-9]/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Interrupts" })).toContainText(
    /interrupts? so far|In the timer handler/,
  );

  await page.getByLabel(/Click here and type/).press("H");
  await page.getByLabel(/Click here and type/).press("i");
  await expect(page.getByLabel(/^Console:/)).toHaveAttribute("aria-label", "Console: Hi", {
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const stack = page.getByRole("list", { name: "Stack, top first" });
  await expect(stack).toBeVisible();
});

test("the extended machine is saved with the program and passes an accessibility check", async ({
  page,
}) => {
  await openSettings(page);
  await page.getByRole("combobox", { name: "Machine" }).selectOption("extended");
  await typeProgram(
    page,
    "        LDA v\n        PUSH\n        CALL s\n        HLT\ns       RET\nv       DAT 7",
  );
  await expect(status(page)).toContainText("Ready");
  await savedExtended(page, "CALL s");
  await page.reload();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(status(page)).toContainText("Ready");
  await openSettings(page);
  await expect(page.getByRole("combobox", { name: "Machine" })).toHaveValue("extended");
  await showTab(page, "Machine");
  await expect(page.getByRole("region", { name: "Stack" })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
