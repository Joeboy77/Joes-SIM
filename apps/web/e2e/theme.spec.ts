import { expect, test } from "@playwright/test";

test("the theme switcher changes and remembers the theme", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const select = page.getByLabel("Theme");

  await select.selectOption("dark");
  await expect(html).toHaveAttribute("data-theme", "dark");

  await select.selectOption("high-contrast");
  await expect(html).toHaveAttribute("data-theme", "high-contrast");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "high-contrast");
  await expect(select).toHaveValue("high-contrast");
});

test("matching the device follows its colour scheme and contrast settings", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("the theme is set before first paint, with no flash", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("joes-sim:theme", "dark"));
  await page.goto("/", { waitUntil: "commit" });
  await page.waitForSelector("body");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("every control is reachable by keyboard", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Joe's SIM" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Simulator", exact: true })).toBeFocused();
  for (const name of ["Learn", "Challenges", "Compiler", "Packs", "Progress"]) {
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true }),
    ).toBeFocused();
  }
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Theme")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Language")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Open the simulator" })).toBeFocused();
});
