import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("the DCIT 207 pack lists the course in order and tracks progress", async ({ page }) => {
  await page.goto("/packs");
  await page.getByRole("link", { name: /DCIT 207/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /DCIT 207/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /von Neumann model/ })).toBeVisible();
  await expect(page.getByText(/0 of \d+ lessons and challenges done/)).toBeVisible();
  await page.getByRole("link", { name: "Echo" }).click();
  const content = page.locator(".cm-content");
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await content.fill("        INP\n        OUT\n        HLT");
  await page.getByRole("button", { name: "Run the tests" }).click();
  await expect(page.getByText(/All 3 tests pass/)).toBeVisible();
  await page.goto("/packs/view?id=dcit-207");
  await expect(page.getByText(/1 of \d+ lessons and challenges done/)).toBeVisible();
  const program = page.getByRole("link", { name: "Assembly next to machine code" });
  await expect(program).toHaveAttribute("href", /^\/sim\?p=/);
});

test("a teacher makes a pack, shares it as a file and a link, and a learner opens both", async ({
  page,
  browser,
}) => {
  await page.goto("/packs/edit");
  await page.getByLabel("Title", { exact: true }).fill("Week 3: loops");
  await page.getByLabel("Author").fill("Ms Mensah");
  await page.getByLabel("A heading").fill("Before class");
  await page.getByRole("button", { name: "Add heading" }).click();
  await page.getByLabel("A lesson").selectOption("loops");
  await page.getByRole("button", { name: "Add lesson" }).click();
  await page.getByLabel("A challenge").selectOption("countdown");
  await page.getByRole("button", { name: "Add challenge" }).click();
  await page.getByLabel("A starter program: title").fill("Count to three");
  await page.getByLabel("Program", { exact: true }).fill("        INP\n        OUT\n        HLT");
  await page.getByRole("button", { name: "Add program" }).click();
  await page.getByRole("button", { name: "Move up: Challenge: Countdown" }).click();
  await page.getByRole("button", { name: "Save the pack" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Week 3: loops" })).toBeVisible();
  await expect(page.getByText("By Ms Mensah")).toBeVisible();
  const items = page.getByRole("listitem").filter({ hasText: /Lesson:|Challenge:|Program:/ });
  await expect(items).toHaveText([
    /Challenge: Countdown/,
    /Lesson: Going round again/,
    /Program: Count to three/,
  ]);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the pack file" }).click();
  const file = await download;
  const json = JSON.parse(await readFile(await file.path(), "utf8"));
  expect(json.format).toBe("joes-sim-pack");

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy a link to this pack" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);

  const learner = await browser.newContext();
  const pupil = await learner.newPage();
  await pupil.goto("/packs");
  await pupil.getByLabel("Choose a teacher pack file").setInputFiles(await file.path());
  await expect(pupil.getByText('Opened "Week 3: loops".')).toBeVisible();
  if (link) {
    await pupil.goto(link);
    await expect(pupil.getByRole("heading", { level: 1, name: "Week 3: loops" })).toBeVisible();
  }
  await learner.close();
});

test("a damaged pack file is refused", async ({ page }) => {
  await page.goto("/packs");
  await page.getByLabel("Choose a teacher pack file").setInputFiles({
    name: "pack.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"format":"joes-sim-pack","version":1,"title":"x","dialect":"z80","items":[]}',
    ),
  });
  await expect(page.getByText("The pack's dialect is not one Joe's SIM knows.")).toBeVisible();
});

test("search engines get a sitemap, robots rules and page descriptions", async ({
  page,
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/challenges/gcd");
  expect(sitemap).toContain("/learn/arrays");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/embed/);
  for (const path of ["/", "/reference", "/learn/loops", "/challenges/multiply", "/docs/embed"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
  }
});
