import { expect, test } from "@playwright/test";

test("a share link opens the exact program, inputs, dialect and view, with a preview card", async ({
  page,
  browser,
}) => {
  await page.goto("/sim");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0); // saved work loaded
  const content = page.locator(".cm-content");
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await content.fill("        INP\n        OTC\n        HLT");
  const settings = page.getByRole("button", { name: "Speed, machine, dialect and view" });
  if (await settings.isVisible()) await settings.click();
  await page.getByLabel("Dialect").selectOption("higginson");
  await page.getByLabel("View", { exact: true }).selectOption("story");
  const io = page
    .getByRole("navigation", { name: "Simulator panels" })
    .getByRole("button", { name: "Inputs & output" });
  if (await io.isVisible()) await io.click();
  await page.getByLabel(/Values for INP to read/).fill("72");

  await page.getByRole("button", { name: "Share" }).click();
  const link = await page.getByLabel("Link").inputValue();
  expect(link).toMatch(/\/sim\?p=[A-Za-z0-9+\-$_]+$/);

  const other = await browser.newContext();
  const friend = await other.newPage();
  await friend.goto(link);
  await expect(friend.locator(".cm-content")).toContainText("OTC");
  await expect(friend.getByText(/Dialect:\s*Higginson/)).toBeVisible();
  await expect(friend.getByRole("button", { name: "Save as a file" })).toBeVisible();
  const ioTab = friend
    .getByRole("navigation", { name: "Simulator panels" })
    .getByRole("button", { name: "Inputs & output" });
  if (await ioTab.isVisible()) await ioTab.click();
  await expect(friend.getByLabel(/Values for INP to read/)).toHaveValue("72");
  const machine = friend
    .getByRole("navigation", { name: "Simulator panels" })
    .getByRole("button", { name: "Machine" });
  if (await machine.isVisible()) await machine.click();
  await expect(friend.getByRole("img", { name: /Story view/ })).toBeVisible();

  const image = await friend.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toMatch(/\/og\?p=/);
  await expect(friend.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  // The card's full address uses SITE_URL; fetch the same path from the test server.
  const url = new URL(image ?? "");
  const card = await friend.request.get(`${url.pathname}${url.search}`);
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toBe("image/png");
  await other.close();
});

const PROGRAM = "        INP\n        OUT\n        HLT";

test("the <joes-sim> element works inside a plain HTML page", async ({ page, baseURL }) => {
  await page.setContent(`<!doctype html>
    <html lang="en"><head><title>My blog</title></head>
    <body>
      <h1>A post about the Little Man Computer</h1>
      <joes-sim dialect="ocr" view="story" inputs="5" panels="editor,machine,io" readonly name="Echo">
        <script type="text/lmc">
${PROGRAM}
        </script>
      </joes-sim>
      <script src="${baseURL}/joes-sim.js"></script>
    </body></html>`);
  const frame = page.frameLocator("joes-sim iframe");
  // The embed loads a whole page in the iframe, which can take a while on a busy machine.
  await expect(frame.getByRole("heading", { name: /Joe's SIM: Echo/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(frame.getByRole("img", { name: /Story view/ })).toBeVisible();
  await expect(frame.getByText(/Dialect:/)).toHaveCount(0); // no status line in the embed
  const before = await frame.locator(".cm-content").textContent();
  await frame.locator(".cm-content").click();
  await page.keyboard.type("XYZ");
  await expect(frame.locator(".cm-content")).toHaveText(before ?? "");
  const settings = frame.getByRole("button", { name: "Speed, machine, dialect and view" });
  if (await settings.isVisible()) await settings.click();
  await frame.getByLabel("Speed").selectOption("instant");
  await frame.getByRole("button", { name: "Run", exact: true }).click();
  await expect(frame.getByRole("list", { name: "Output values" })).toHaveText("005");
  await expect(frame.getByRole("link", { name: /Open in Joe's SIM/ })).toHaveAttribute(
    "href",
    /\/sim\?p=/,
  );
});

test("the embed works in a sandboxed iframe, as learning platforms use", async ({
  page,
  baseURL,
}) => {
  const src = `${baseURL}/embed?program=${encodeURIComponent(PROGRAM)}&inputs=9&panels=machine,io`;
  await page.setContent(`<!doctype html><html lang="en"><head><title>Course page</title></head><body>
    <iframe title="LMC" src="${src}" width="900" height="700"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>
  </body></html>`);
  const frame = page.frameLocator("iframe");
  await expect(frame.locator(".cm-content")).toHaveCount(0); // editor panel not chosen
  const settings = frame.getByRole("button", { name: "Speed, machine, dialect and view" });
  if (await settings.isVisible()) await settings.click();
  await frame.getByLabel("Speed").selectOption("fast");
  await frame.getByRole("button", { name: "Run", exact: true }).click();
  await expect(frame.getByRole("list", { name: "Output values" })).toHaveText("009");
});
