import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  "index.html",
  "projects.html",
  "themis.html",
  "billacord.html",
  "actionproof.html",
  "financial-qa.html",
  "tampstamp.html",
  "nationwide-governance.html",
  "blog_homepage.html",
  "create_agent.html",
  "engineering-reliable-ai.html",
  "orchestrate_simplified.html",
  "404.html",
];

test("project filters update visible cards and announce the result", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".project-card:visible")).toHaveCount(6);
  for (const name of [
    "AI & evaluation",
    "Product engineering",
    "Governance & controls",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".project-card:visible")).toHaveCount(2);
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#filter-status")).toContainText(
      "2 projects shown",
    );
  }
  await page.getByRole("button", { name: "All work" }).click();
  await expect(page.locator(".project-card:visible")).toHaveCount(6);
});

test("mobile menu supports navigation, Escape, and desktop resizing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Menu" });
  await expect(page.locator("#navigation")).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("#navigation")).toBeHidden();
  await expect(menu).toBeFocused();
  await menu.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await expect(page).toHaveURL(/#work$/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("#navigation")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#navigation")).toBeHidden();
});

test("essential content and navigation work without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4178/");
  await expect(page.locator(".project-card")).toHaveCount(6);
  await expect(page.locator("#navigation")).toBeVisible();
  await page
    .getByRole("link", { name: "Read case study: Billacord", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "From contract terms to billing evidence.",
    }),
  ).toBeVisible();
  await context.close();
});

test("resume is served as the supplied PDF", async ({ request }) => {
  const response = await request.get("/assets/owen-le-resume.pdf");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

for (const file of pages) {
  test(`${file}: accessible, error-free, and responsive`, async ({ page }) => {
    const problems = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        problems.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(`/${file}`);
    await page.evaluate(() => document.fonts.ready);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `Horizontal overflow at ${width}px`,
      ).toBeTruthy();
    }
    expect(problems).toEqual([]);
  });
}
