import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function typeProgram(page: Page, source: string) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0); // saved work loaded
  const content = page.locator(".cm-content").first();
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await content.fill(source);
}

/** Waits until IndexedDB holds a file whose source contains `text`. */
async function savedFile(page: Page, text: string) {
  await expect
    .poll(() =>
      page.evaluate(
        (t) =>
          new Promise<boolean>((resolve) => {
            const r = indexedDB.open("joes-sim");
            r.onsuccess = () => {
              const all = r.result.transaction("files").objectStore("files").getAll();
              all.onsuccess = () =>
                resolve((all.result as { source: string }[]).some((f) => f.source.includes(t)));
            };
            r.onerror = () => resolve(false);
          }),
        text,
      ),
    )
    .toBe(true);
}

/** Waits for fades and slides to finish, so contrast is checked on the final colours. */
async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
}

async function openFiles(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Your files" });
  if (!(await dialog.isVisible())) await page.getByRole("button", { name: /manage files/ }).click();
  return dialog;
}

const SUM =
  "        INP\n        STA first\n        INP\n        ADD first\n        OUT\n        HLT\nfirst   DAT";

test("work is saved as you type and is still there after closing the browser", async ({
  page,
  context,
}) => {
  await page.goto("/sim");
  await expect(page.getByRole("button", { name: /My first program/ })).toBeVisible();
  await typeProgram(page, "        INP\n        OUT\n        OUT\n        HLT\n// kept");
  await savedFile(page, "// kept");
  await page.close();
  const again = await context.newPage();
  await again.goto("/sim");
  await expect(again.locator(".cm-content")).toContainText("// kept");
});

test("files can be created, renamed, duplicated, deleted, exported and imported", async ({
  page,
}) => {
  await page.goto("/sim");
  let files = await openFiles(page);
  await files.getByRole("button", { name: "New file" }).click();
  await expect(page.getByRole("button", { name: /Untitled\s*: manage files/ })).toBeVisible();
  await typeProgram(page, "        INP\n        HLT\n// reader");
  await savedFile(page, "// reader");

  files = await openFiles(page);
  await files.getByRole("button", { name: "Rename Untitled" }).click();
  await files.getByLabel("New name").fill("Reader");
  await files.getByRole("button", { name: "Save name" }).click();
  await expect(files.getByRole("button", { name: /^Reader/ })).toBeVisible();
  await files.getByRole("button", { name: "Duplicate Reader" }).click();
  await expect(
    page.getByRole("button", { name: /Reader \(copy\)\s*: manage files/ }),
  ).toBeVisible();

  files = await openFiles(page);
  page.once("dialog", (d) => void d.accept());
  await files.getByRole("button", { name: "Delete Reader (copy)" }).click();
  await expect(files.getByRole("button", { name: "Delete Reader (copy)" })).toHaveCount(0);

  const download = page.waitForEvent("download");
  await files.getByRole("button", { name: "Export this program (.lmc)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.lmc$/);
  expect(await readFile(await file.path(), "utf8")).toMatch(/^\/\/ dialect: classic\n/);

  await files.getByLabel("Choose an .lmc file to import").setInputFiles({
    name: "countdown.lmc",
    mimeType: "text/plain",
    buffer: Buffer.from("// dialect: ocr\n        INP\nloop    OUT\n        HLT\n"),
  });
  await expect(page.getByRole("button", { name: /countdown\s*: manage files/ })).toBeVisible();
  await expect(page.getByText("Dialect: OCR").or(page.getByText(/Dialect:\s*OCR/))).toBeVisible();
});

test("a challenge's tests run in the browser, show scores and record the solve", async ({
  page,
}) => {
  await page.goto("/challenges/sum-two-numbers");
  await typeProgram(page, SUM);
  await page.getByRole("button", { name: "Run the tests" }).click();
  await expect(page.getByText("All 3 tests pass. Well done!")).toBeVisible();
  await expect(page.getByText(/✓ Pass/)).toHaveCount(3);
  await expect(page.getByText(/Instructions: 6 \(target 6\)/)).toBeVisible();
  await page.goto("/challenges");
  const card = page.getByRole("listitem").filter({ hasText: "Add two numbers" });
  await expect(card.getByText("Solved")).toBeVisible();
});

test("a failing test opens in the simulator where the output first differs", async ({ page }) => {
  await page.goto("/challenges/sum-two-numbers");
  await typeProgram(
    page,
    "        INP\n        OUT\n        STA a\n        INP\n        ADD a\n        OUT\n        HLT\na       DAT",
  );
  await page.getByRole("button", { name: "Run the tests" }).click();
  await expect(page.getByText("0 of 3 tests pass.")).toBeVisible();
  await page.getByRole("link", { name: "Open in the simulator at step 2" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Step 2." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save as a file" })).toBeVisible();
});

test("the model solution opens only after a genuine attempt", async ({ page }) => {
  await page.goto("/challenges/double");
  await expect(page.getByText(/The model solution opens once/)).toBeVisible();
  // Three versions that differ from the starter (which is INP, OUT, HLT).
  for (const extra of [
    "OUT\n        OUT",
    "OUT\n        OUT\n        OUT",
    "STA 50\n        OUT",
  ]) {
    await typeProgram(page, `        INP\n        ${extra}\n        HLT`);
    await page.getByRole("button", { name: "Run the tests" }).click();
    await expect(page.getByText(/tests pass/)).toBeVisible();
  }
  await page.getByRole("button", { name: "Show the model solution" }).click();
  await expect(page.locator("pre").filter({ hasText: "ADD n" })).toBeVisible();
});

test("predict mode asks before each step and keeps score", async ({ page }) => {
  await page.goto("/sim");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0); // saved work loaded
  const nav = page
    .getByRole("navigation", { name: "Simulator panels" })
    .getByRole("button", { name: "Explain", exact: true });
  if (await nav.isVisible()) await nav.click();
  await page.getByRole("button", { name: "Predict each step" }).click();
  await expect(
    page.getByText("After mailbox 00 (INP), what will the accumulator hold?"),
  ).toBeVisible();
  await page.getByLabel("Your prediction").fill("3");
  await page.getByRole("button", { name: "Check and step" }).click();
  await expect(page.getByText("✓ Right!")).toBeVisible();
  await page.getByLabel("Your prediction").fill("9");
  await page.getByRole("button", { name: "Check and step" }).click();
  await expect(page.getByText("✗ Not quite: the answer was 3.")).toBeVisible();
  // The last answer is saved a moment later; check until it is there.
  await expect(async () => {
    await page.goto("/progress");
    await expect(page.getByText("Overall: 50% (1 of 2)")).toBeVisible({ timeout: 1000 });
  }).toPass();
});

test("a lesson drives its simulators, asks questions and is marked finished", async ({ page }) => {
  await page.goto("/learn/decisions");
  await page.getByRole("button", { name: "b", exact: true }).click();
  await expect(page.getByText(/✓ Yes\./)).toBeVisible();
  const sim = page.getByRole("region", { name: "The bigger one" });
  const gear = sim.getByRole("button", { name: "Speed, machine, dialect and view" });
  if (await gear.isVisible()) await gear.click();
  await sim.getByLabel("Speed").selectOption("instant");
  await sim.getByRole("button", { name: "Run", exact: true }).click();
  await expect(sim.getByRole("img", { name: /Flow graph/ })).toBeVisible();
  await expect(sim.getByRole("list", { name: "Output values" })).toHaveText("008");
  await page.getByRole("button", { name: "I have finished this lesson" }).click();
  await expect(page.getByText("✓ You have finished this lesson.")).toBeVisible();
  await page.goto("/learn");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Making decisions" }).getByText("Finished"),
  ).toBeVisible();
});

test("a backup moved to another device restores everything", async ({ page, browser }) => {
  await page.goto("/sim");
  await typeProgram(page, "        INP\n        OUT\n        HLT\n// moved");
  await savedFile(page, "// moved");
  await page.goto("/challenges/echo");
  await typeProgram(page, "        INP\n        OUT\n        HLT");
  await page.getByRole("button", { name: "Run the tests" }).click();
  await expect(page.getByText(/All 3 tests pass/)).toBeVisible();
  await page.goto("/progress");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download a backup" }).click();
  const backup = await download;
  expect(backup.suggestedFilename()).toMatch(/^joes-sim-backup-\d{4}-\d{2}-\d{2}\.json$/);

  const other = await browser.newContext();
  const fresh = await other.newPage();
  await fresh.goto("/progress");
  await expect(fresh.getByText(/0 of \d+ solved/)).toBeVisible();
  fresh.once("dialog", (d) => void d.accept());
  await fresh.getByLabel("Choose a backup file").setInputFiles(await backup.path());
  await expect(fresh.getByText(/Restored \d+ files? and your progress/)).toBeVisible();
  await expect(fresh.getByText(/1 of \d+ solved/)).toBeVisible();
  await fresh.goto("/sim");
  await expect(fresh.locator(".cm-content")).toContainText("// moved");
  await other.close();
});

test("a damaged backup is refused and changes nothing", async ({ page }) => {
  await page.goto("/progress");
  await page.getByLabel("Choose a backup file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"something-else"}'),
  });
  await expect(page.getByText("This is not a Joe's SIM backup file.")).toHaveAttribute(
    "role",
    "alert",
  );
});

test("challenges and lessons make no request outside the site", async ({ page, baseURL }) => {
  const outside: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith(baseURL ?? "") &&
      !r.url().startsWith("data:") &&
      !r.url().startsWith("blob:")
    )
      outside.push(r.url());
  });
  await page.goto("/challenges/sum-two-numbers");
  await typeProgram(page, SUM);
  await page.getByRole("button", { name: "Run the tests" }).click();
  await expect(page.getByText(/All 3 tests pass/)).toBeVisible();
  await page.goto("/learn/arithmetic");
  await page.getByRole("button", { name: "995 with the negative flag set" }).click();
  await page.getByRole("button", { name: "Run", exact: true }).first().click();
  await page.goto("/progress");
  expect(outside).toEqual([]);
});

test("work and progress come back offline", async ({ page, context }) => {
  test.setTimeout(120_000); // the service worker caches every page when it installs
  await page.goto("/sim");
  await typeProgram(page, "        INP\n        HLT\n// offline");
  await savedFile(page, "// offline");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The service worker caches the main pages when it installs; give it a moment to finish.
  await page.waitForFunction(
    async () =>
      (await caches.keys()).length > 0 &&
      (await (await caches.open((await caches.keys())[0] as string)).keys()).length > 5,
  );
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".cm-content")).toContainText("// offline");
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
  await context.setOffline(false);
});

test("the challenge and lesson pages have no accessibility violations after use", async ({
  page,
}) => {
  const scan = async () =>
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  await page.goto("/challenges/sum-two-numbers");
  await typeProgram(page, SUM);
  await page.getByRole("button", { name: "Run the tests" }).click();
  await expect(page.getByText(/All 3 tests pass/)).toBeVisible();
  await page.getByRole("button", { name: "Show a hint" }).click();
  await settled(page);
  expect(await scan()).toEqual([]);
  await page.goto("/learn/keeping-numbers");
  await page.getByRole("button", { name: "The same number as before" }).click();
  expect(await scan()).toEqual([]);
});
