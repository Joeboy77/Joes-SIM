import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const status = (page: Page) => page.getByRole("status");
const output = (page: Page) => page.getByRole("list", { name: "Output values" });

async function openSettings(page: Page) {
  const gear = page.getByRole("button", { name: "Speed, machine, dialect and view" });
  if ((await gear.isVisible()) && (await gear.getAttribute("aria-expanded")) !== "true")
    await gear.click();
}

async function setSpeed(page: Page, speed: string) {
  await openSettings(page);
  await page.getByLabel("Speed").selectOption(speed);
}

/** Shows a panel: a tab on phones; on larger screens, a side-panel tab if it has one. */
async function showTab(page: Page, name: string) {
  const tab = page
    .getByRole("navigation", { name: "Simulator panels" })
    .getByRole("button", { name, exact: true });
  if (await tab.isVisible()) return tab.click();
  const side = page.getByRole("group", { name: "Side panels" }).getByRole("button", { name });
  if (await side.isVisible()) await side.click();
}

async function setView(page: Page, view: string) {
  await openSettings(page);
  await page.getByLabel("View", { exact: true }).selectOption(view);
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
  // Shortcuts wait until the learner's saved work has loaded.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
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
  await showTab(page, "Explain");
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
  await setView(page, "story");
  await page.getByRole("button", { name: "Pause" }).click();
  await showTab(page, "Machine");
  const story = page.getByRole("img", { name: /Story view/ });
  await expect(story).toBeVisible();
  await setView(page, "datapath");
  await expect(page.getByRole("img", { name: /Datapath/ })).toBeVisible();
});

test("the shortcut sheet opens with ? and closes", async ({ page }) => {
  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("all three views have no accessibility violations", async ({ page }) => {
  for (let i = 0; i < 2; i++) await page.keyboard.press("s");
  const scan = () =>
    new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(
    (await scan()).violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
  for (const panel of ["v", "v"]) {
    await page.keyboard.press(panel);
    expect(
      (await scan()).violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      ),
    ).toEqual([]);
  }
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

test("the narration explains each step, at beginner and technical level", async ({ page }) => {
  await page.keyboard.press("m");
  await showTab(page, "Explain");
  const explain = page.getByRole("region", { name: "What just happened" });
  await expect(explain).toContainText(
    "The Little Man reads the program counter: the next instruction is in mailbox 00.",
  );
  await page.getByRole("button", { name: "Technical" }).click();
  await expect(explain).toContainText("Fetch: copy the PC (00) into the MAR.");
  await page.getByRole("button", { name: "Beginner" }).click();
  for (let i = 0; i < 5; i++) await page.keyboard.press("m");
  await page.keyboard.press("s");
  await expect(explain).toContainText(
    "The instruction is 306, so the Little Man stores the accumulator (3) in mailbox 06.",
  );
});

test("the trace table fills in, jumps to a step, exports and checks answers", async ({ page }) => {
  await setSpeed(page, "instant");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(status(page)).toContainText("Finished after 6 instructions");
  await showTab(page, "Trace");
  const table = page.getByRole("table", { name: /Trace table/ });
  await expect(table.getByRole("row")).toHaveCount(7);
  await expect(table.getByRole("row").nth(4)).toContainText("ADD first");
  await table.getByRole("button", { name: "Go to step 2" }).click();
  await expect(status(page)).toContainText("Step 2.");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const csv = await download;
  expect(csv.suggestedFilename()).toBe("trace.csv");

  await page.getByRole("button", { name: "Fill-in mode" }).click();
  await page.getByLabel("ACC, step 1", { exact: true }).fill("3");
  await page.getByLabel("ACC, step 2", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Check my answers" }).click();
  await expect(page.getByRole("status").filter({ hasText: "correct" })).toContainText(
    /^1 of \d+ correct/,
  );
  await expect(page.getByLabel("ACC, step 2", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

test("an error offers the step that caused it, and hints one tier at a time", async ({ page }) => {
  await typeProgram(page, "        LDA v\n        STA x\nx       DAT 0\nv       DAT 450");
  await setSpeed(page, "fast");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(status(page)).toContainText("Stopped at mailbox 02");
  await showTab(page, "Explain");
  await page.getByRole("button", { name: "Show a hint" }).first().click();
  await expect(page.getByText("Nudge:")).toBeVisible();
  await page.getByRole("button", { name: "Show more" }).first().click();
  await expect(page.getByText("Pointer:")).toBeVisible();
  await page.getByRole("button", { name: "Go to the step that caused this (step 2)" }).click();
  await expect(status(page)).toContainText("Step 1. Next instruction at mailbox 01");
});

test("the heatmap and number card show how each mailbox was used", async ({ page }) => {
  await setSpeed(page, "instant");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(status(page)).toContainText("Finished");
  await showTab(page, "Machine");
  await page.getByRole("button", { name: "Heatmap" }).click();
  const first = page.getByRole("button", { name: /^Mailbox 06/ });
  await expect(first).toHaveAccessibleName(/used as data/);
  await expect(first).toHaveAccessibleName(/read 1, written 1 times/);
  // Scrolling can pass the pointer over other mailboxes, and the card follows the pointer.
  await first.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await first.focus();
  await expect(page.getByText(/Two's complement \(10-bit\) 00 0000 0011/)).toBeVisible();
});

test("run until stops when a condition becomes true", async ({ page }) => {
  await showTab(page, "Watch");
  await page.getByLabel("Stop when").selectOption("acc");
  await page.getByLabel("Is", { exact: true }).selectOption("==");
  await page.getByLabel("Value", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Add condition" }).click();
  await expect(page.getByText("Stop when the accumulator is 4")).toBeVisible();
  await setSpeed(page, "fast");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(status(page)).toContainText("Stopped after step 3, because the accumulator is 4.");
  await expect(page.getByRole("cell", { name: /^4/ }).first()).toBeVisible();
});

test("the flow graph counts each trip round a loop", async ({ page }) => {
  await typeProgram(
    page,
    "        INP\nloop    OUT\n        SUB one\n        BRP loop\n        HLT\none     DAT 1",
  );
  await showTab(page, "Inputs & output");
  await page.getByLabel(/Values for INP to read/).fill("3");
  await setView(page, "flow");
  await setSpeed(page, "instant");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(status(page)).toContainText("Finished");
  await showTab(page, "Machine");
  await expect(page.getByRole("img", { name: /Flow graph/ })).toHaveAccessibleName(
    /The loop back to mailbox 01 has gone round 3 times/,
  );
});

for (const theme of ["light", "dark", "high-contrast"]) {
  test(`the trace, watch and heatmap have no accessibility violations (${theme})`, async ({
    page,
  }) => {
    await page.addInitScript((t) => localStorage.setItem("joes-sim:theme", t), theme);
    await page.goto("/sim");
    await setSpeed(page, "instant");
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(status(page)).toContainText("Finished");
    const scan = async () =>
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    await showTab(page, "Machine");
    await page.getByRole("button", { name: "Heatmap" }).click();
    expect(await scan()).toEqual([]);
    await showTab(page, "Trace");
    expect(await scan()).toEqual([]);
    await page.getByRole("button", { name: "Fill-in mode" }).click();
    await page.getByLabel("ACC, step 1", { exact: true }).fill("9");
    await page.getByRole("button", { name: "Check my answers" }).click();
    expect(await scan()).toEqual([]);
    await showTab(page, "Watch");
    expect(await scan()).toEqual([]);
  });
}
