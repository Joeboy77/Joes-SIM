import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** The community service is on in these tests: playwright.config.ts starts it locally. */

async function typeProgram(page: Page, source: string) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0); // saved work loaded
  const content = page.locator(".cm-content").first();
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await content.fill(source);
}

/** Waits for fades and slides to finish, so contrast is checked on the final colours. */
async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
}

async function scan(page: Page) {
  await settled(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

/** A nickname no other test (or browser project) uses. */
const unique = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 8)}`;

async function openShare(page: Page) {
  await page.getByRole("button", { name: "Share" }).click();
  return page.getByRole("dialog", { name: "Share this program" });
}

test("a solved challenge goes on the leaderboard under a nickname", async ({ page, browser }) => {
  await page.goto("/challenges/echo");
  const board = page.getByRole("region", { name: "Leaderboard" });
  await expect(board.getByText("Pass every test to post your scores here.")).toBeVisible();
  await typeProgram(page, "        INP\n        OUT\n        HLT");
  await page.getByRole("button", { name: "Run the tests" }).click();
  await expect(page.getByText(/All 3 tests pass/)).toBeVisible();

  await board.getByRole("button", { name: "Show the leaderboard" }).click();
  const nickname = unique("Ama");
  await board.getByLabel("Nickname").fill(nickname);
  await board.getByRole("button", { name: "Post my scores" }).click();
  await expect(board.getByRole("status")).toContainText(`Posted as ${nickname}`);
  const mine = board.getByRole("listitem").filter({ hasText: `${nickname} (you)` });
  await expect(mine).toContainText("3");
  await expect(board.getByText(/You are \d+(st|nd|rd|th) of \d+ with 3/)).toBeVisible();
  expect(await scan(page)).toEqual([]);

  // Another browser sees the entry, but not as theirs.
  const other = await browser.newContext();
  const friend = await other.newPage();
  await friend.goto("/challenges/echo");
  await friend.getByRole("button", { name: "Show the leaderboard" }).click();
  await friend.getByLabel("Rank by").selectOption("mailboxes");
  await expect(
    friend.getByRole("region", { name: "Leaderboard" }).getByText(nickname, { exact: true }),
  ).toBeVisible();
  await other.close();

  await board.getByRole("button", { name: "Take my scores off" }).click();
  await expect(board.getByRole("status")).toContainText("off this leaderboard");
  await expect(board.getByText(`${nickname} (you)`)).toHaveCount(0);
});

test("a short link opens the same program", async ({ page, browser }) => {
  await page.goto("/sim");
  const marker = unique("// short ");
  await typeProgram(page, `        INP\n        OUT\n        HLT\n${marker}`);
  const dialog = await openShare(page);
  await dialog.getByRole("button", { name: "Make a short link" }).click();
  const short = await dialog.getByLabel("Short link").inputValue();
  expect(short).toMatch(/\/s\/[A-Za-z0-9]{7}$/);

  const other = await browser.newContext();
  const friend = await other.newPage();
  await friend.goto(short);
  await expect(friend).toHaveURL(/\/sim\?p=/);
  await expect(friend.locator(".cm-content")).toContainText(marker);
  await other.close();
});

test("an unknown short link says so", async ({ page }) => {
  await page.goto("/s/zzzzzzz");
  await expect(
    page.getByRole("heading", { name: "This link does not open anything" }),
  ).toBeVisible();
});

test("a program published to the gallery can be opened, reported and deleted", async ({
  page,
  browser,
}) => {
  await page.goto("/sim");
  const marker = unique("// gallery ");
  await typeProgram(page, `        INP\n        OUT\n        HLT\n${marker}`);
  const dialog = await openShare(page);
  await dialog.getByText("Publish to the gallery").click();
  const title = unique("Echo ");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("What it does (optional)").fill("Outputs what it reads.");
  await dialog.getByLabel("Your nickname").fill(unique("Kofi"));
  await dialog.getByRole("button", { name: "Publish" }).click();
  await dialog.getByRole("link", { name: "See it in the gallery" }).click();

  const card = page.getByRole("listitem").filter({ hasText: title });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Outputs what it reads.");
  await expect(card.getByRole("button", { name: `Delete ${title}` })).toBeVisible();
  expect(await scan(page)).toEqual([]);

  // Someone else can open it and report it, but not delete it.
  const other = await browser.newContext();
  const friend = await other.newPage();
  await friend.goto("/gallery");
  const theirs = friend.getByRole("listitem").filter({ hasText: title });
  await expect(theirs.getByRole("button", { name: `Delete ${title}` })).toHaveCount(0);
  await theirs.getByRole("button", { name: `Report ${title}` }).click();
  await theirs.getByLabel("What is wrong with it? (optional)").fill("Testing reports");
  await theirs.getByRole("button", { name: "Send report" }).click();
  await expect(friend.getByRole("status")).toContainText("A moderator will look at it");
  await theirs.getByRole("link", { name: `Open ${title} in the simulator` }).click();
  await expect(friend.locator(".cm-content")).toContainText(marker);
  await other.close();

  page.once("dialog", (d) => void d.accept());
  await card.getByRole("button", { name: `Delete ${title}` }).click();
  await expect(page.getByRole("status")).toContainText(`“${title}” is deleted.`);
  await expect(page.getByRole("listitem").filter({ hasText: title })).toHaveCount(0);
});

test("the gallery filters by machine", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page.getByRole("heading", { name: "Gallery", level: 1 })).toBeVisible();
  await page.getByLabel("Machine").selectOption("multicore");
  await expect(
    page.getByRole("listitem").filter({ hasText: /Classic LMC|Extended machine/ }),
  ).toHaveCount(0);
});

test("without the community service, the core still works and says so", async ({ page }) => {
  await page.route("http://localhost:8789/**", (route) => route.abort());
  await page.goto("/challenges/echo");
  await page.getByRole("button", { name: "Show the leaderboard" }).click();
  await expect(page.getByRole("region", { name: "Leaderboard" }).getByRole("alert")).toContainText(
    "could not be reached",
  );
  await typeProgram(page, "        INP\n        OUT\n        HLT");
  await page.getByRole("button", { name: "Run the tests" }).click();
  await expect(page.getByText(/All 3 tests pass/)).toBeVisible();
});
