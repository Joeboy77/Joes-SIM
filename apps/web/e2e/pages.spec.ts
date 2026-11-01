import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/", heading: /See what a computer is doing/ },
  { path: "/sim", heading: "Simulator" },
  { path: "/embed", heading: "Joe's SIM" },
  { path: "/learn", heading: "Learn" },
  { path: "/learn/arrays", heading: "Arrays and self-modifying code" },
  { path: "/challenges", heading: "Challenges" },
  { path: "/challenges/max-of-two", heading: "The bigger one" },
  { path: "/progress", heading: "Your progress" },
  { path: "/packs", heading: "Teacher packs" },
  { path: "/packs/view?id=dcit-207", heading: /DCIT 207/ },
  { path: "/packs/edit", heading: "Edit a teacher pack" },
  { path: "/reference", heading: "Instruction reference" },
  { path: "/docs", heading: "Docs" },
  { path: "/docs/embed", heading: "Embedding the simulator" },
  { path: "/docs/getting-started", heading: "Getting started" },
  { path: "/about", heading: "About Joe's SIM" },
  { path: "/privacy", heading: "Privacy" },
  { path: "/contribute", heading: "Contribute" },
  // Phases 6 to 11.
  { path: "/learn/interrupts-and-devices", heading: "Interrupts and devices" },
  { path: "/learn/pipelining", heading: "Pipelining" },
  { path: "/learn/races-and-locks", heading: "Many cores: races and locks" },
  { path: "/learn/lmc-to-riscv", heading: "From LMC to RISC-V" },
  { path: "/challenges/pick-a-cache", heading: "Choose a cache that hits 80%" },
  { path: "/compiler", heading: "Little Language compiler" },
  { path: "/riscv", heading: "RISC-V" },
  { path: "/machines", heading: "Machine designer" },
  { path: "/gallery", heading: "Gallery" },
  { path: "/docs/sharing", heading: "Sharing and backups" },
  { path: "/docs/offline", heading: "Offline and installing" },
  { path: "/docs/packs", heading: "Teacher packs" },
];
const THEMES = ["light", "dark", "high-contrast"] as const;

for (const { path, heading } of PAGES) {
  test(`${path} loads`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  });

  for (const theme of THEMES) {
    test(`${path} has no accessibility violations in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("joes-sim:theme", t), theme);
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
      ).toEqual([]);
    });
  }
}
