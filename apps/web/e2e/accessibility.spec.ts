import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/sim",
  "/learn/decisions",
  "/challenges/max-of-two",
  "/packs/view?id=dcit-207",
  "/reference",
  "/progress",
  "/docs/embed",
];

test.describe("reflow at 320 CSS pixels (WCAG 2.2, 1.4.10)", () => {
  test.use({ viewport: { width: 320, height: 640 } });
  for (const path of PAGES) {
    test(`${path} needs no sideways scrolling`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test("text can be spaced out without anything being cut off (WCAG 2.2, 1.4.12)", async ({
  page,
}) => {
  await page.goto("/");
  await page.addStyleTag({
    content:
      "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }",
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("motion is reduced when the device asks", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/sim");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0); // saved work has loaded
  const machine = page
    .getByRole("navigation", { name: "Simulator panels" })
    .getByRole("button", { name: "Machine" });
  if (await machine.isVisible()) await machine.click();
  await page.keyboard.press("m");
  await page.keyboard.press("m");
  // With reduced motion, transfers are listed as text instead of animated.
  await expect(page.getByText(/MEMORY → MDR/)).toBeVisible();
  await context.close();
});
