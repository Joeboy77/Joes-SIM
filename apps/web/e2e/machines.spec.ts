import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
}

test("RISC-V: a program runs, steps through the datapath and prints", async ({ page }) => {
  await page.goto("/riscv");
  const editor = page.getByLabel("RISC-V assembly");
  await editor.fill(
    ".text\n  li a0, 6\n  addi a0, a0, 1\n  li a7, 1\n  ecall\n  li a7, 10\n  ecall\n",
  );
  await expect(page.getByRole("list", { name: /Assembled instructions/ })).toContainText(
    "addi a0, zero, 6",
  );
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await page.getByRole("button", { name: /^WB/ }).click();
  await expect(page.getByText("Write back: a0 ← 7")).toBeVisible();
  await expect(page.getByText(/addi a0, a0, 1: the ALU adds/)).toBeVisible();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("region", { name: /^Console/ })).toHaveAttribute(
    "aria-label",
    "Console: 7",
  );
  await expect(page.getByText(/Finished after 6 instructions \(exit\)/)).toBeVisible();
  await page.getByRole("button", { name: "Step back" }).click();
  await expect(page.getByText("Step 5.", { exact: false })).toBeVisible();
  await settled(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("a teacher adds an instruction to LMC without code, tests it and shares it", async ({
  page,
  context,
}) => {
  await page.goto("/machines");
  await page
    .getByLabel("Start from")
    .selectOption("lmc")
    .catch(() => undefined);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(/Little Man Computer|LMC/);
  await page.getByLabel("Name", { exact: true }).fill("LMC with DBL");

  // A new instruction: DBL doubles the accumulator, at the free opcode 4.
  await page.getByRole("button", { name: "Add an instruction" }).click();
  const added = page.locator("details").last();
  await added.locator("summary").click();
  await added.getByLabel("Mnemonic").fill("DBL");
  await added.getByLabel("Opcode").fill("4");
  await added.getByLabel("DBL step 1: operation").selectOption("alu");
  await added.getByLabel("DBL step 1: function").selectOption("add");
  await expect(page.getByRole("region", { name: "Problems with this machine" })).toHaveCount(0);

  const tester = page.getByRole("region", { name: "Test the machine" });
  await tester.getByLabel("Program").fill("        INP\n        DBL\n        OUT\n        HLT");
  await tester.getByLabel("Inputs").fill("21");
  await tester.getByRole("button", { name: "Run", exact: true }).click();
  await expect(tester.getByText("Output:")).toContainText("42");
  await tester.getByRole("button", { name: "Reset" }).click();
  for (let i = 0; i < 6; i++) await tester.getByRole("button", { name: "Micro-step" }).click();
  await expect(tester.getByRole("img", { name: /Datapath of LMC with DBL/ })).toBeVisible();

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy share link" }).click();
  await expect(page.getByRole("status").first()).toContainText(/Link copied|Copy this link/);
  const link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  if (link) {
    const other = await context.newPage();
    await other.goto(link);
    await expect(other.getByLabel("Name", { exact: true })).toHaveValue("LMC with DBL");
    await expect(other.getByText("Opened the machine from the link.")).toBeVisible();
  }
  await settled(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("the comparison lesson shows LMC and RISC-V side by side", async ({ page }) => {
  await page.goto("/learn/lmc-to-riscv");
  await expect(page.getByRole("region", { name: "RISC-V: add two numbers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /LMC: add two numbers/ })).toBeVisible();
});
