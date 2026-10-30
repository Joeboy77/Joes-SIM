import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const status = (page: Page) => page.getByRole("status");
const output = (page: Page) => page.getByRole("list", { name: "Output values" });

async function openSettings(page: Page) {
  const gear = page.getByRole("button", { name: "Speed, dialect and view" });
  if ((await gear.isVisible()) && (await gear.getAttribute("aria-expanded")) !== "true")
    await gear.click();
}

async function setSpeed(page: Page, speed: string) {
  await openSettings(page);
  await page.getByLabel("Speed").selectOption(speed);
}

async function showTab(page: Page, name: string) {
  const tab = page
    .getByRole("navigation", { name: "Simulator panels" })
    .getByRole("button", { name });
  if (await tab.isVisible()) await tab.click();
}

async function typeProgram(page: Page, source: string) {
  await showTab(page, "Code");
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await page.locator(".cm-content").fill(source);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/sim");
  await expect(page.locator(".cm-editor")).toBeVisible();
});

test("a beginner can run the add-two-numbers program and see 7", async ({ page }) => {
  await expect(status(page)).toContainText("Ready");
  await setSpeed(page, "fast");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(status(page)).toContainText("Finished after 6 instructions");
  await showTab(page, "Inputs & output");
  await expect(output(page)).toHaveText("007");
});

test("writing a program, with its own inputs, and running it instantly in the worker", async ({
  page,
}) => {
  await typeProgram(page, "        INP\n        ADD ten\n        OUT\n        HLT\nten     DAT 10");
  await showTab(page, "Inputs & output");
  await page.getByLabel(/Values for INP to read/).fill("32");
  await setSpeed(page, "instant");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(status(page)).toContainText("Finished after 4 instructions");
  await expect(output(page)).toHaveText("042");
});

test("a mistake is explained with a suggestion and the machine waits until it is fixed", async ({
  page,
}) => {
  await typeProgram(page, "loop    INP\n        BRA lop");
  await expect(status(page)).toContainText("1 error to fix");
  await showTab(page, "Inputs & output");
  await expect(page.getByText("Label 'lop' is not defined. Did you mean 'loop'?")).toBeVisible();
});

test("stepping forwards and backwards by instruction and by micro-step", async ({ page }) => {
  for (let i = 0; i < 3; i++) await page.keyboard.press("s");
  await expect(status(page)).toContainText("Step 3.");
  await page.keyboard.press("Shift+S");
  await expect(status(page)).toContainText("Step 2.");
  await page.keyboard.press("m");
  await page.keyboard.press("Shift+M");
  await expect(status(page)).toContainText("Step 2.");
  await page.getByRole("button", { name: "Step back one instruction" }).click();
  await page.getByRole("button", { name: "Step back one instruction" }).click();
  await expect(status(page)).toContainText("Ready");
});

test("the machine asks for input when it runs out, then carries on", async ({ page }) => {
  await showTab(page, "Inputs & output");
  await page.getByLabel(/Values for INP to read/).fill("3");
  await setSpeed(page, "fast");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "waiting" })).toContainText(
    "waiting at the in-tray",
  );
  await page.getByLabel("Input value").fill("4");
  await page.getByRole("button", { name: "Give input" }).click();
  await expect(status(page)).toContainText("Finished");
  await expect(output(page)).toHaveText("007");
});

test("a breakpoint set on a mailbox pauses the run there", async ({ page }) => {
  await showTab(page, "Machine");
  await page.getByRole("button", { name: /^Mailbox 04/ }).click();
  await expect(page.getByRole("button", { name: /^Mailbox 04/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await setSpeed(page, "fast");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(status(page)).toContainText("Paused at the breakpoint on mailbox 04");
});

test("switching view and pausing mid-animation always shows the true state", async ({ page }) => {
  await setSpeed(page, "slow");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.waitForTimeout(1200);
  await openSettings(page);
  await page.getByRole("button", { name: "Switch to story view" }).click();
  await page.getByRole("button", { name: "Pause" }).click();
  await showTab(page, "Machine");
  const story = page.getByRole("img", { name: /Story view/ });
  await expect(story).toBeVisible();
  await page.getByRole("button", { name: "Switch to datapath view" }).click();
  await expect(page.getByRole("img", { name: /Datapath/ })).toBeVisible();
});

test("the shortcut sheet opens with ? and closes", async ({ page }) => {
  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("both views have no accessibility violations", async ({ page }) => {
  for (let i = 0; i < 2; i++) await page.keyboard.press("s");
  const scan = () =>
    new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(
    (await scan()).violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
  await page.keyboard.press("v");
  expect(
    (await scan()).violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
});

test("a branch shows where it goes and whether it was taken", async ({ page }) => {
  await typeProgram(page, "        INP\n        BRZ done\n        OUT\ndone    HLT");
  await showTab(page, "Inputs & output");
  await page.getByLabel(/Values for INP to read/).fill("5");
  await page.getByRole("button", { name: "Step one instruction" }).click();
  await page.getByRole("button", { name: "Step one instruction" }).click();
  await showTab(page, "Machine");
  await expect(page.getByRole("note")).toContainText("mailbox 01 to 03: ✗ not taken");
  await expect(page.getByRole("button", { name: /^Mailbox 03/ })).toHaveAccessibleName(
    /branch target, not taken/,
  );
});
