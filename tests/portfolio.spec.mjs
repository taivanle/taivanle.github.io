import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  "index.html",
  "projects.html",
  "themis.html",
  "billacord.html",
  "actionproof.html",
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
  await expect(page.locator(".project-card:visible")).toHaveCount(3);
  for (const name of [
    "AI & evaluation",
    "Product engineering",
    "Governance & controls",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".project-card:visible")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#filter-status")).toContainText(
      "1 project shown",
    );
  }
  await page.getByRole("button", { name: "All work" }).click();
  await expect(page.locator(".project-card:visible")).toHaveCount(3);
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
  await expect(page.locator(".project-card")).toHaveCount(3);
  await expect(page.locator("#navigation")).toBeVisible();
  await page
    .getByRole("link", { name: "Read case study: Billacord", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "From contract terms to billing evidence.",
    }),
  ).toBeVisible();
  await expect(page.locator(".scene:visible")).toHaveCount(6);
  await expect(page.locator(".stage-panel:visible")).toHaveCount(4);
  await context.close();
});

test("presentations support scene navigation, architecture exploration, and reading view", async ({
  page,
}) => {
  await page.goto("/themis.html#architecture");
  await expect(page.locator(".scene:visible")).toHaveCount(1);
  await expect(page.locator("#architecture")).toBeVisible();
  await page.locator('[data-stage="2"]').click();
  await expect(page.locator("#stage-panel-2")).toBeVisible();
  await expect(page.locator(".stage-panel:visible")).toHaveCount(1);
  await expect(page.locator('[data-stage="2"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator(".presentation-shell").press("ArrowRight");
  await expect(page.locator("#build")).toBeVisible();
  await expect(page.locator("#build .scene-title")).toBeFocused();
  await expect(page).toHaveURL(/#build$/);
  await page
    .getByRole("button", { name: "Scene 6: Perspective", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Next scene", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Scene 1: Overview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Previous scene", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Read all at once", exact: true })
    .click();
  await expect(page.locator(".scene:visible")).toHaveCount(6);
  await expect(page.locator(".stage-panel:visible")).toHaveCount(4);
  await expect(page.locator(".presentation-navigation")).toBeHidden();
  await page.reload();
  await expect(page.locator(".scene:visible")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Presentation view", exact: true })
    .click();
  await expect(page.locator(".scene:visible")).toHaveCount(1);
});

for (const project of ["themis", "billacord", "actionproof"]) {
  test(`${project}: every presentation scene is accessible and fits small and wide screens`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${project}.html`);
    for (let scene = 0; scene < 6; scene++) {
      await page.locator(`[data-scene="${scene}"]`).click();
      await expect(page.locator(".scene:visible")).toHaveCount(1);
      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        accessibility.violations.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => node.target),
        })),
      ).toEqual([]);
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          `${project} scene ${scene + 1} at ${width}px`,
        ).toBeTruthy();
      }
    }
  });
}

test("resume is served as the supplied PDF", async ({ request }) => {
  const response = await request.get("/assets/owen-le-resume.pdf");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("the demonstration clip starts only on request and can be paused", async ({
  page,
}) => {
  await page.goto("/");
  const video = page.locator("[data-portrait-video]");
  expect(
    await video.evaluate(
      (element) => element.paused && !element.autoplay && element.muted,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Play clip", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause clip", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      video.evaluate((element) => !element.paused && element.readyState >= 2),
    )
    .toBeTruthy();
  await page.getByRole("button", { name: "Pause motion", exact: true }).click();
  expect(await video.evaluate((element) => element.paused)).toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Play clip", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("video delivery supports partial downloads for playback", async ({
  request,
}) => {
  const response = await request.get("/assets/media/owen-at-work.mp4", {
    headers: { Range: "bytes=0-1023" },
  });
  expect(response.status()).toBe(206);
  expect(response.headers()["content-type"]).toBe("video/mp4");
  expect(response.headers()["content-range"]).toMatch(/^bytes 0-1023\//);
  expect((await response.body()).length).toBe(1024);
});

test("decorative motion can be paused and respects reduced-motion settings", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pause motion", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/motion-paused/);
  expect(
    await page
      .locator(".orbit-lines")
      .evaluate((element) => getComputedStyle(element).animationPlayState),
  ).toBe("paused");
  await page
    .getByRole("button", { name: "Resume motion", exact: true })
    .click();
  await expect(page.locator("html")).not.toHaveClass(/motion-paused/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".orbit-lines")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await expect(page.locator(".motion-toggle")).toBeHidden();
});

test("project illustrations and labels stay separate at wide sizes and enlarged zoom", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  for (const width of [2560, 1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const issues = await page
      .locator(".project-visual")
      .evaluateAll((figures) =>
        figures.flatMap((figure) => {
          const [label, illustration, caption] = [...figure.children].map(
            (element) => element.getBoundingClientRect(),
          );
          const bounds = figure.getBoundingClientRect();
          const issues = [];
          if (label.bottom > illustration.top + 1)
            issues.push("Label overlaps illustration");
          if (illustration.bottom > caption.top + 1)
            issues.push("Caption overlaps illustration");
          for (const item of [label, illustration, caption]) {
            if (
              item.left < bounds.left - 1 ||
              item.right > bounds.right + 1 ||
              item.bottom > bounds.bottom + 1
            )
              issues.push("Content escapes its figure");
          }
          return issues;
        }),
      );
    expect(issues, `Figure layout at ${width}px`).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addStyleTag({ content: "html { zoom: 1.5; }" });
  expect(
    await page.locator(".project-visual").evaluateAll((figures) =>
      figures.every((figure) => {
        const [label, illustration, caption] = [...figure.children].map(
          (element) => element.getBoundingClientRect(),
        );
        return (
          label.bottom <= illustration.top + 1 &&
          illustration.bottom <= caption.top + 1
        );
      }),
    ),
  ).toBeTruthy();
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
    for (const width of [1920, 1440, 1024, 768, 390, 320]) {
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
