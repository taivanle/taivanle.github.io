import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  "index.html",
  "projects.html",
  "themis.html",
  "dueform.html",
  "actifact.html",
  "financial-qa.html",
  "vodafone-tobi.html",
  "nationwide-governance.html",
  "blog_homepage.html",
  "create_agent.html",
  "engineering-reliable-ai.html",
  "orchestrate_simplified.html",
  "404.html",
];

test("project scenes accept immediate arrow keys, animate both ways, and handle rapid changes", async ({
  page,
}) => {
  await page.goto("/projects.html");
  await page
    .getByRole("link", { name: "Read case study: ActiFact", exact: true })
    .click();
  await expect(page).toHaveURL(/actifact.html$/);
  const arrivalTravel = () =>
    page.evaluate(() => {
      const scene = document.querySelector(".scene.is-active");
      const animation = scene
        .getAnimations()
        .find((item) => item.effect.target === scene);
      const transform = animation?.effect.getKeyframes()[0].transform;
      return transform ? new DOMMatrix(transform).m41 : null;
    });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#problem")).toBeVisible();
  await expect.poll(arrivalTravel).toBeGreaterThan(0);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-page-transition",
    "entering",
  );
  const frame = await page.locator(".presentation-deck").boundingBox();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#architecture")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#problem")).toBeVisible();
  await expect.poll(arrivalTravel).toBeLessThan(0);
  await expect(page.locator(".scene:visible")).toHaveCount(1);
  const during = await page.locator(".presentation-deck").boundingBox();
  expect(during.x).toBeCloseTo(frame.x, 0);
  expect(during.width).toBeCloseTo(frame.width, 0);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#results$/);
  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator(".scene:visible")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Scene 6: Perspective", exact: true })
    .click();
  await expect(page.locator("#scope")).toBeVisible();
  await expect.poll(arrivalTravel).toBeNull();
});

test("all five chapter handoffs have moving currents and scroll-driven type in both directions", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".chapter-rule")).toHaveCount(5);
  const sections = ["work", "about", "experience", "community", "notes"];
  for (const [index, section] of sections.entries()) {
    const divider = page.locator(`#${section} .chapter-rule`);
    await expect(divider.locator(".chapter-index")).toHaveText(
      String(index + 1).padStart(2, "0"),
    );
    await divider.scrollIntoViewIfNeeded();
    await expect(divider).toHaveClass(/is-divider-active/);
    const current = divider.locator(".chapter-current-core");
    const offset = () =>
      current.evaluate((el) =>
        parseFloat(getComputedStyle(el).strokeDashoffset),
      );
    const firstOffset = await offset();
    await expect
      .poll(async () => Math.abs((await offset()) - firstOffset))
      .toBeGreaterThan(2);
    const word = divider.locator(".chapter-word");
    const travel = () =>
      word.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    const start = await travel();
    await page.mouse.wheel(0, 120);
    await expect.poll(travel).toBeLessThan(start - 5);
    const forward = await travel();
    await page.mouse.wheel(0, -120);
    await expect.poll(travel).toBeGreaterThan(forward + 5);
    await expect(page.locator(`#${section} h2`).first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.locator("#work .chapter-rule")).not.toHaveClass(
    /is-divider-active/,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator("#notes .chapter-word")
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe("none");
  expect(
    await page
      .locator("#notes .chapter-word")
      .evaluate((el) => el.getAnimations().length),
  ).toBe(0);
  await expect(page.locator("#notes .chapter-current-core")).not.toBeVisible();
  await expect(page.locator("#notes h2")).toBeVisible();
});

test("chapter locks release immediately, work in both directions, and keep active and hover states distinct", async ({
  page,
}) => {
  await page.goto("/#experience");
  const section = page.locator("#experience");
  const top = () => section.evaluate((el) => el.getBoundingClientRect().top);
  const padding = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
  );
  await expect
    .poll(async () => Math.abs((await top()) - padding))
    .toBeLessThan(2);
  await expect(page.locator(".nav-link[aria-current]")).toHaveText(
    "Experience",
  );
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, 60);
  await page.waitForTimeout(700);
  await expect.poll(top).toBeLessThan(padding - 40);
  await page.mouse.wheel(0, 360);
  await expect.poll(top).toBeLessThan(padding - 300);
  await page.mouse.wheel(0, -350);
  await expect
    .poll(async () => Math.abs((await top()) - padding))
    .toBeLessThan(2);
  await page.mouse.wheel(0, -60);
  await page.waitForTimeout(700);
  await expect.poll(top).toBeGreaterThan(padding + 40);
  await page.mouse.wheel(0, -360);
  await expect.poll(top).toBeGreaterThan(padding + 300);
  await page.mouse.wheel(0, 350);
  await expect
    .poll(async () => Math.abs((await top()) - padding))
    .toBeLessThan(2);
  await page.getByRole("link", { name: "Owen Le home", exact: true }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  await expect(page.locator(".nav-link[aria-current]")).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "About", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("#about")
        .evaluate((el) =>
          Math.abs(
            el.getBoundingClientRect().top -
              parseFloat(
                getComputedStyle(document.documentElement).scrollPaddingTop,
              ),
          ),
        ),
    )
    .toBeLessThan(2);
  await expect(page.locator(".nav-link[aria-current]")).toHaveText("About");
  const active = nav.getByRole("link", { name: "About", exact: true });
  const hover = nav.getByRole("link", { name: "Experience", exact: true });
  const normal = await hover.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  const hoverBounds = await hover.boundingBox();
  await page.mouse.move(
    hoverBounds.x + hoverBounds.width / 2,
    hoverBounds.y + hoverBounds.height / 2,
  );
  await expect
    .poll(() => hover.evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(normal);
  await expect(active).toHaveAttribute("aria-current", "location");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await nav.getByRole("link", { name: "Experience", exact: true }).click();
  await expect
    .poll(async () => Math.abs((await top()) - padding))
    .toBeLessThan(2);
  await page.mouse.wheel(0, 420);
  await page.mouse.wheel(0, -350);
  await page.waitForTimeout(700);
  await expect.poll(top).toBeLessThan(padding - 40);
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`all landing chapters lock on approach and remain readable at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const padding = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
    );
    const approach = Math.min(280, (viewport.height - padding) * 0.38);
    const chapters = ["work", "about", "experience", "community", "notes"];
    const top = (id) =>
      page.locator(`#${id}`).evaluate((el) => el.getBoundingClientRect().top);
    for (const id of chapters) {
      await page.mouse.wheel(0, (await top(id)) - padding - approach);
      await expect
        .poll(async () => Math.abs((await top(id)) - padding))
        .toBeLessThan(2);
      await page.mouse.wheel(0, 60);
      await page.waitForTimeout(750);
      await expect.poll(() => top(id)).toBeLessThan(padding - 40);
    }
    for (const id of chapters.slice(0, -1).reverse()) {
      await page.mouse.wheel(0, (await top(id)) - padding + approach);
      await expect
        .poll(async () => Math.abs((await top(id)) - padding))
        .toBeLessThan(2);
    }
    await page.mouse.wheel(0, -(await page.evaluate(() => scrollY)) + approach);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
    await expect(page.locator(".nav-link[aria-current]")).toHaveCount(0);
  });
}

test("the shared navigation bubble visibly travels between sections and follows menu resizing", async ({
  page,
}) => {
  await page.goto("/#about");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const bubble = page.locator(".nav-indicator");
  const about = nav.getByRole("link", { name: "About", exact: true });
  const experience = nav.getByRole("link", { name: "Experience", exact: true });
  await expect(about).toHaveAttribute("aria-current", "location");
  const aligned = (link) =>
    Promise.all([bubble.boundingBox(), link.boundingBox()]).then(([a, b]) =>
      a && b
        ? Math.abs(a.x - b.x) +
          Math.abs(a.y - b.y) +
          Math.abs(a.width - b.width)
        : Infinity,
    );
  await expect.poll(() => aligned(about)).toBeLessThan(2);
  const travel = page.evaluate(
    () =>
      new Promise((resolve) => {
        const samples = [];
        const start = performance.now();
        let alignedFrames = 0;
        function sample() {
          const current = document.querySelector(".nav-link[aria-current]");
          const bubble = document
            .querySelector(".nav-indicator")
            .getBoundingClientRect();
          const target = current?.getBoundingClientRect();
          const error = target
            ? Math.abs(bubble.x - target.x) +
              Math.abs(bubble.width - target.width)
            : Infinity;
          samples.push({ section: current?.textContent, error });
          if (current?.textContent === "Experience" && error < 2)
            alignedFrames++;
          else alignedFrames = 0;
          if (alignedFrames >= 3 || performance.now() - start > 5000)
            resolve(samples);
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      }),
  );
  const target = await experience.boundingBox();
  await page.mouse.click(
    target.x + target.width / 2,
    target.y + target.height / 2,
  );
  await expect(experience).toHaveAttribute("aria-current", "location");
  expect(
    (await travel).some(
      (frame) => frame.section === "Experience" && frame.error > 3,
    ),
  ).toBe(true);
  await expect.poll(() => aligned(experience)).toBeLessThan(2);
  await page.setViewportSize({ width: 390, height: 844 });
  const clickVisible = async (element) => {
    const bounds = await element.boundingBox();
    await page.mouse.click(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
  };
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await clickVisible(menu);
  await expect
    .poll(() => aligned(nav.locator(".nav-link[aria-current]")))
    .toBeLessThan(2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await clickVisible(about);
  await clickVisible(menu);
  await expect(about).toHaveAttribute("aria-current", "location");
  await expect.poll(() => aligned(about)).toBeLessThan(2);
  expect(await bubble.evaluate((el) => el.getAnimations().length)).toBe(0);
});

test("the detailed Orchestrate guide supports both paths, screenshots, and its original FAQ download", async ({
  page,
  request,
}) => {
  await page.goto("/create_agent.html");
  const toc = page.getByRole("navigation", { name: "Article sections" });
  await toc.getByRole("link", { name: "Python FAQ tool", exact: true }).click();
  await expect(page).toHaveURL(/#adk-tool$/);
  await expect(
    page.getByRole("heading", {
      name: "Create the Python FAQ tool",
      exact: true,
    }),
  ).toBeVisible();
  await toc.getByRole("link", { name: "Visual builder", exact: true }).click();
  await expect(page).toHaveURL(/#visual-builder$/);
  const firstScreenshot = page.locator("#visual-builder img").first();
  await firstScreenshot.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      firstScreenshot.evaluate(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    )
    .toBe(true);
  const download = page.getByRole("link", {
    name: "Download the original sample FAQ document",
    exact: true,
  });
  const response = await request.get(await download.getAttribute("href"));
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
});

test("project filters update visible cards and announce the result", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".project-card:visible")).toHaveCount(6);
  for (const [name, count] of [
    ["AI & evaluation", 3],
    ["Product engineering", 1],
    ["Governance & controls", 2],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".project-card:visible")).toHaveCount(count);
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#filter-status")).toContainText(
      `${count} ${count === 1 ? "project" : "projects"} shown`,
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
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".project-card")).toHaveCount(6);
  await expect(page.locator("#navigation")).toBeVisible();
  await page
    .getByRole("link", { name: "Read case study: DueForm", exact: true })
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

for (const project of [
  "themis",
  "dueform",
  "actifact",
  "financial-qa",
  "vodafone-tobi",
  "nationwide-governance",
]) {
  test(`${project}: every presentation scene is accessible and fits small and wide screens`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const frames = new Map();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${project}.html`);
    await expect(page.locator(".contact-section")).toHaveCount(0);
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
      for (const [width, height] of [
        [1440, 900],
        [1280, 720],
        [900, 600],
        [390, 667],
        [320, 900],
        [320, 667],
      ]) {
        await page.setViewportSize({ width, height });
        const fit = await page.evaluate(() => {
          const scene = document.querySelector(".scene.is-active");
          const frame = document.querySelector(".presentation-deck");
          const controls = document.querySelector(".presentation-navigation");
          return {
            content: scene.scrollHeight,
            height: scene.clientHeight,
            frame: frame.getBoundingClientRect().height,
            bottom: controls.getBoundingClientRect().bottom,
            page: document.documentElement.scrollHeight,
            viewport: innerHeight,
          };
        });
        const size = `${width}×${height}`;
        if (!frames.has(size)) frames.set(size, fit.frame);
        expect(fit.frame).toBeCloseTo(frames.get(size), 0);
        expect(
          fit.content,
          `${project} ${scene + 1}: unclipped at ${width}×${height}`,
        ).toBeLessThanOrEqual(fit.height + 1);
        expect(fit.bottom).toBeLessThanOrEqual(height);
        expect(fit.page).toBeLessThanOrEqual(height);
        const deck = await page.locator(".presentation-deck").boundingBox();
        if (scene === 0 && width === 320 && height === 667) {
          const menu = page.getByRole("button", { name: "Menu", exact: true });
          await menu.click();
          await expect(page.locator("#navigation")).toBeVisible();
          const glass = await page.locator(".site-header").boundingBox();
          const navBounds = await page.locator("#navigation").boundingBox();
          expect(navBounds.y + navBounds.height).toBeLessThanOrEqual(
            glass.y + glass.height,
          );
          expect(
            (await page.locator(".presentation-deck").boundingBox()).height,
          ).toBeCloseTo(deck.height, 0);
          await menu.click();
        }
        for (const selector of [
          ".design-toggle",
          ".detail-toggle",
          "[data-build]",
        ]) {
          for (const control of await page
            .locator(`.scene.is-active ${selector}:visible`)
            .all()) {
            await control.click();
            const content = await page
              .locator(".scene.is-active")
              .evaluate((el) => ({
                height: el.clientHeight,
                content: el.scrollHeight,
              }));
            expect(
              content.content,
              `${project} detail at ${width}×${height}`,
            ).toBeLessThanOrEqual(content.height + 1);
            expect(
              (await page.locator(".presentation-deck").boundingBox()).height,
            ).toBeCloseTo(deck.height, 0);
          }
        }
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

test("the demonstration clip autoplays silently, loops, and stops off screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const video = page.locator("[data-portrait-video]");
  await expect
    .poll(() =>
      video.evaluate(
        (v) =>
          !v.paused && v.currentTime > 0 && v.muted && v.loop && !v.controls,
      ),
    )
    .toBeTruthy();
  await video.evaluate((v) => {
    v.currentTime = v.duration - 0.15;
  });
  await expect
    .poll(() => video.evaluate((v) => v.currentTime < 1 && !v.paused))
    .toBeTruthy();
  await page.locator("#community").scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((v) => v.paused)).toBeTruthy();
  await page.getByRole("link", { name: "Owen Le home", exact: true }).click();
  await expect.poll(() => video.evaluate((v) => !v.paused)).toBeTruthy();
  await expect(
    page.getByRole("button", { name: /Pause|Play clip|Resume motion/ }),
  ).toHaveCount(0);
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

test("the visual field moves and reduced motion stops the field and video", async ({
  page,
}) => {
  await page.goto("/");
  const field = page.locator(".hero-field");
  const pixels = () =>
    field.evaluate((canvas) => {
      const data = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 0;
      for (let i = 0; i < data.length; i += 13)
        hash = Math.imul(hash ^ data[i], 16777619);
      return hash;
    });
  const initial = await pixels();
  await expect.poll(pixels).not.toBe(initial);
  await page.locator("#community").scrollIntoViewIfNeeded();
  await expect(field).toBeInViewport();
  const afterScroll = await pixels();
  await expect.poll(pixels).not.toBe(afterScroll);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => page.locator("video").evaluate((v) => v.paused))
    .toBeTruthy();
  const still = await pixels();
  await page.waitForTimeout(200);
  expect(await pixels()).toBe(still);
});

test("event photos, showcasing, and both mentoring projects are available", async ({
  page,
}) => {
  await page.goto("/#community");
  const photos = page.locator(".event-gallery img");
  await expect(photos).toHaveCount(3);
  const buttons = page.locator("[data-event-select]");
  for (let index = 0; index < 3; index++) {
    await buttons.nth(index).click();
    await expect(buttons.nth(index)).toHaveAttribute("aria-pressed", "true");
    await expect(photos.nth(index)).toBeVisible();
    await expect
      .poll(() =>
        photos
          .nth(index)
          .evaluate((image) => image.complete && image.naturalWidth > 0),
      )
      .toBeTruthy();
    await expect(page.locator("[data-event-photo]:visible")).toHaveCount(1);
    const background = await buttons
      .nth(index)
      .evaluate((button) => getComputedStyle(button).backgroundImage);
    expect(background).not.toContain("assets/assets");
  }
  await expect(page.locator(".event-gallery figcaption")).toHaveCount(0);
  await buttons.nth(0).click();
  await buttons.nth(1).press("Enter");
  await expect(photos.nth(1)).toBeVisible();
  await expect(page.locator("[data-event-status]")).toContainText(
    "Photo 2 of 3",
  );
  await expect(page.locator("#community")).toContainText(
    "watsonx Orchestrate to clients",
  );
  await expect(page.locator("#community")).toContainText(
    "watsonx.governance at The AI Summit London in 2025",
  );
  await expect(page.locator(".mentorship-panel")).toContainText(
    "two groups of University of Nottingham",
  );
  await expect(
    page.getByRole("link", { name: /Learning through VR/ }),
  ).toHaveAttribute("href", /7196899451309805568/);
  await expect(
    page.getByRole("link", { name: /Security Crisis/ }),
  ).toHaveAttribute("href", /7328587937892233216/);
});

test("result labels stay inside their own columns at every breakpoint", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const project of [
    "themis",
    "dueform",
    "actifact",
    "financial-qa",
    "vodafone-tobi",
    "nationwide-governance",
  ]) {
    await page.goto(`/${project}.html#results`);
    await page.evaluate(() => document.fonts.ready);
    for (const width of [2560, 1920, 1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const issues = await page
        .locator(".presentation-result")
        .evaluateAll((columns) =>
          columns.flatMap((column) => {
            const bounds = column.getBoundingClientRect();
            return [...column.querySelectorAll("strong, p, .label")].flatMap(
              (element) => {
                const range = document.createRange();
                range.selectNodeContents(element);
                return [...range.getClientRects()]
                  .filter(
                    (rect) =>
                      rect.left < bounds.left - 1 ||
                      rect.right > bounds.right + 1,
                  )
                  .map(() => element.textContent);
              },
            );
          }),
        );
      expect(issues, `${project} results at ${width}px`).toEqual([]);
    }
  }
});

test("the cursor follower responds to project hover without blocking navigation", async ({
  page,
}) => {
  await page.goto("/");
  const project = page.getByRole("link", {
    name: "Read case study: Themis",
    exact: true,
  });
  await project.scrollIntoViewIfNeeded();
  await project.hover();
  await expect(page.locator(".cursor-tracker")).toHaveClass(/is-visible/);
  await expect(page.locator(".cursor-tracker")).toHaveClass(/is-link/);
  await project.click();
  await expect(page).toHaveURL(/themis.html$/);
  await expect(
    page.getByRole("heading", { name: "Themis", exact: true }),
  ).toBeVisible();
});

test("the cursor follower stays hidden for reduced motion and touch", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/");
  await page.mouse.move(160, 200);
  await expect(page.locator(".cursor-tracker")).toHaveClass(/is-visible/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".cursor-tracker")).toBeHidden();
  await expect(page.locator("html")).not.toHaveClass(/cursor-active/);
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const touchPage = await context.newPage();
  await touchPage.goto("/");
  await touchPage.mouse.move(160, 200);
  await expect(touchPage.locator(".cursor-tracker")).toBeHidden();
  await context.close();
});

test("project card text stays within its frame at narrow, wide, and enlarged sizes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  for (const width of [2560, 1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const issues = await page.locator(".card-frame").evaluateAll((frames) =>
      frames.flatMap((frame) => {
        const bounds = frame.getBoundingClientRect();
        const caption = frame
          .querySelector(".card-caption")
          .getBoundingClientRect();
        const issues = [];
        for (const element of frame.querySelectorAll(
          ".card-meta, .card-copy, .card-skills",
        )) {
          const box = element.getBoundingClientRect();
          if (
            box.right > bounds.right + 1 ||
            box.left < bounds.left - 1 ||
            box.bottom > caption.top - 6
          )
            issues.push(
              frame.querySelector("h3").textContent +
                ": content escapes the frame",
            );
          const range = document.createRange();
          range.selectNodeContents(element);
          if (
            [...range.getClientRects()].some(
              (r) => r.right > bounds.right + 1 || r.left < bounds.left - 1,
            )
          )
            issues.push(
              frame.querySelector("h3").textContent +
                ": text escapes the frame",
            );
        }
        return issues;
      }),
    );
    expect(issues, `Cards at ${width}px`).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addStyleTag({ content: "html { zoom: 1.5; }" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("project illustrations and labels stay separate at wide sizes and enlarged zoom", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dueform.html");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".project-visual")).toHaveCount(1);
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

test("project cards expand into a dark presentation and return through the real frame", async ({
  page,
}) => {
  await page.addInitScript(() => {
    function animations(node) {
      return (
        node?.getAnimations().map((animation) => ({
          duration: animation.effect.getTiming().duration,
          frames: animation.effect.getKeyframes().map((frame) => ({
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
            transform: frame.transform,
            clipPath: frame.clipPath,
            opacity: frame.opacity,
          })),
        })) || []
      );
    }
    document.addEventListener("portfolio-transition", (event) => {
      if (!["entering", "leaving"].includes(event.detail.phase)) return;
      const stage = document.querySelector(".navigation-flip-stage");
      if (!stage) return;
      const rotor = stage.querySelector(".navigation-card-rotor");
      const layout = () => ({
        x: parseFloat(stage.style.left),
        y: parseFloat(stage.style.top),
        width: parseFloat(stage.style.width),
        height: parseFloat(stage.style.height),
      });
      const fixedLayout = layout();
      const geometry = stage
        .getAnimations()
        .find((animation) => animation.effect.getKeyframes()[0].transform);
      const evidence = {
        ...event.detail,
        inert: stage.inert,
        hidden: stage.getAttribute("aria-hidden"),
        geometry: animations(stage),
        layout: fixedLayout,
        geometryBounds: geometry.effect.getKeyframes().map((frame) => {
          const matrix = new DOMMatrix(frame.transform);
          return {
            x: fixedLayout.x + matrix.e,
            y: fixedLayout.y + matrix.f,
            width: fixedLayout.width * matrix.a,
            height: fixedLayout.height * matrix.d,
          };
        }),
        rotation: animations(rotor),
        backRotation: stage.querySelector(".navigation-card-back").style
          .transform,
        frontName: stage.querySelector(".navigation-card-front h3")
          ?.textContent,
        samples: [],
        scan: null,
      };
      const key = `${location.pathname}:${event.detail.phase}:${event.detail.direction}`;
      const save = () => {
        const stored = JSON.parse(
          sessionStorage.getItem("tested-card-motion") || "{}",
        );
        stored[key] = evidence;
        sessionStorage.setItem("tested-card-motion", JSON.stringify(stored));
      };
      save();
      function sample() {
        const main = document.querySelector("main");
        const field = document.querySelector(".hero-field");
        const cover = document.getElementById("navigation-cover");
        const progress = stage.querySelector(".navigation-card-progress-fill");
        if (main && field) {
          evidence.samples.push({
            layout: layout(),
            foregroundFilter: getComputedStyle(main).filter,
            fieldFilter: getComputedStyle(field).filter,
            fieldOpacity: Number(getComputedStyle(field).opacity),
            coverOpacity: cover ? Number(getComputedStyle(cover).opacity) : 0,
            firstPaintCover: getComputedStyle(
              document.documentElement,
              "::before",
            ).content,
            progress: progress
              ? 1 -
                parseFloat(getComputedStyle(progress).strokeDashoffset) / 100
              : null,
          });
        }
        const scan = document.querySelector(".navigation-card-scan");
        if (scan) {
          evidence.scan = {
            appReady: document.documentElement.classList.contains("js"),
            line: animations(scan),
            deck: animations(document.querySelector(".presentation-deck")),
            overlay: animations(stage),
          };
        }
        save();
        if (stage.isConnected) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
  });
  await page.goto("/index.html#work");
  const card = page
    .locator('.project-card[data-category="ai"] .card-frame')
    .first();
  await expect(card).toHaveAttribute("data-project", "themis");
  await page
    .getByRole("link", { name: "Read case study: Themis", exact: true })
    .click();
  await expect(page).toHaveURL(/themis.html$/);
  await expect(page.locator(".presentation-deck")).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-page-transition",
    /entering|leaving/,
  );
  await expect(
    page.locator(".navigation-flip-stage, .navigation-card-scan"),
  ).toHaveCount(0);
  const opening = await page.evaluate(() => ({
    evidence: JSON.parse(sessionStorage.getItem("tested-card-motion")),
    origin: JSON.parse(
      sessionStorage.getItem(`portfolio-project-origin:${location.pathname}`),
    ).rect,
    deck: document
      .querySelector(".presentation-deck")
      .getBoundingClientRect()
      .toJSON(),
  }));
  const sourceOpen = opening.evidence["/index.html:leaving:open"];
  const arrivalOpen = opening.evidence["/themis.html:entering:open"];
  expect(sourceOpen.duration).toBe(520);
  expect(arrivalOpen.duration).toBe(250);
  const geometry = (record) =>
    record.geometry.find((animation) => animation.frames[0].transform);
  for (const key of ["x", "y", "width", "height"]) {
    expect(sourceOpen.geometryBounds[0][key]).toBeCloseTo(
      opening.origin[key],
      1,
    );
    expect(sourceOpen.geometryBounds.at(-1)[key]).toBeCloseTo(
      arrivalOpen.geometryBounds[0][key],
      1,
    );
    expect(arrivalOpen.geometryBounds.at(-1)[key]).toBeCloseTo(
      opening.deck[key],
      1,
    );
  }
  expect(geometry(sourceOpen).duration).toBe(520);
  expect(geometry(arrivalOpen).duration).toBe(0);
  expect(sourceOpen.rotation[0].frames.map((frame) => frame.transform)).toEqual(
    ["rotateX(0deg)", "rotateX(180deg)"],
  );
  expect(
    arrivalOpen.rotation[0].frames.map((frame) => frame.transform),
  ).toEqual(["rotateX(180deg)", "rotateX(180deg)"]);
  expect(arrivalOpen.rotation[0].duration).toBe(0);
  expect(arrivalOpen.backRotation).toBe("rotateX(180deg)");
  expect(arrivalOpen.scan).not.toBeNull();
  expect(arrivalOpen.scan.appReady).toBe(true);
  expect(
    Math.max(...arrivalOpen.samples.map((sample) => sample.progress || 0)),
  ).toBeGreaterThanOrEqual(0.99);
  expect(arrivalOpen.scan.line[0].duration).toBe(180);
  const scanReveal = arrivalOpen.scan.deck.find(
    (animation) => animation.frames[0].clipPath,
  );
  expect(scanReveal.duration).toBe(180);
  expect(scanReveal.frames[0].clipPath).toContain("100%");
  expect(scanReveal.frames.at(-1).clipPath).not.toContain("100%");
  expect(
    await page
      .locator("body")
      .evaluate((body) => getComputedStyle(body).backgroundColor),
  ).toBe("rgb(12, 28, 26)");
  await expect(page.locator(".hero-field")).toBeVisible();
  await page
    .getByRole("button", { name: "Scene 3: Architecture", exact: true })
    .click();
  await expect(page.locator("#architecture")).toBeVisible();
  await page.getByRole("link", { name: "Selected work", exact: true }).click();
  await expect(page).toHaveURL(/index.html#work$/);
  await expect(
    page.getByRole("link", { name: "Read case study: Themis", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-page-transition",
    /entering|leaving/,
  );
  const closing = await page.evaluate(() => ({
    evidence: JSON.parse(sessionStorage.getItem("tested-card-motion")),
    card: document
      .querySelector('.card-frame[data-project="themis"]')
      .getBoundingClientRect()
      .toJSON(),
    nativeNames: [
      getComputedStyle(document.documentElement).viewTransitionName,
      getComputedStyle(
        document.querySelector('.card-frame[data-project="themis"]'),
      ).viewTransitionName,
    ],
  }));
  const sourceClose = closing.evidence["/themis.html:leaving:close"];
  const arrivalClose = closing.evidence["/index.html:entering:close"];
  expect(sourceClose.duration).toBe(460);
  expect(arrivalClose.duration).toBe(140);
  expect(geometry(sourceClose).duration).toBe(460);
  expect(geometry(arrivalClose).duration).toBe(0);
  expect(
    sourceClose.rotation[0].frames.map((frame) => frame.transform),
  ).toEqual(["rotateX(0deg)", "rotateX(-180deg)"]);
  expect(
    arrivalClose.rotation[0].frames.map((frame) => frame.transform),
  ).toEqual(["rotateX(0deg)", "rotateX(0deg)"]);
  expect(arrivalClose.rotation[0].duration).toBe(0);
  expect(arrivalClose.frontName).toBe("Themis");
  for (const key of ["x", "y", "width", "height"]) {
    expect(sourceClose.geometryBounds.at(-1)[key]).toBeCloseTo(
      arrivalClose.geometryBounds[0][key],
      1,
    );
    expect(arrivalClose.geometryBounds.at(-1)[key]).toBeCloseTo(
      closing.card[key],
      1,
    );
  }
  for (const record of [sourceOpen, sourceClose]) {
    expect(
      record.samples.every(
        (sample) =>
          JSON.stringify(sample.layout) === JSON.stringify(record.layout),
      ),
    ).toBe(true);
    for (const frame of geometry(record).frames) {
      expect(frame.transform).toBeTruthy();
      for (const property of ["left", "top", "width", "height"])
        expect(frame[property]).toBeUndefined();
    }
  }
  for (const record of [sourceOpen, arrivalOpen, sourceClose, arrivalClose]) {
    expect(record.inert).toBe(true);
    expect(record.hidden).toBe("true");
    expect(record.samples.length).toBeGreaterThan(0);
    expect(
      record.samples.some(
        (sample) =>
          parseFloat(
            /blur\(([^)]+)\)/.exec(sample.foregroundFilter)?.[1] || "0",
          ) > 0,
      ),
    ).toBe(true);
    expect(
      record.samples.every(
        (sample) => sample.fieldFilter === "none" && sample.fieldOpacity > 0,
      ),
    ).toBe(true);
    expect(record.samples.every((sample) => sample.coverOpacity === 0)).toBe(
      true,
    );
    expect(
      record.samples.every((sample) =>
        ["none", "normal"].includes(sample.firstPaintCover),
      ),
    ).toBe(true);
  }
  expect(closing.nativeNames).toEqual(["none", "none"]);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-page-transition",
    /entering|leaving/,
  );
  await expect(
    page.locator(
      ".navigation-return-frame, .navigation-flip-stage, .navigation-card-scan",
    ),
  ).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-card-transition",
    "true",
  );
  await expect(page.locator("main")).toHaveCSS("filter", "none");
  const title = page.locator("#work-title");
  await expect(title).toBeVisible();
  const stableTitle = await title.evaluate(async (element) => {
    const samples = [];
    const until = performance.now() + 1000;
    do {
      await new Promise(requestAnimationFrame);
      const style = getComputedStyle(element);
      samples.push({
        opacity: Number(style.opacity),
        clip: style.clipPath,
        transform: style.transform,
        visibility: style.visibility,
      });
    } while (performance.now() < until || samples.length < 20);
    return samples;
  });
  expect(stableTitle.every((sample) => sample.opacity >= 0.98)).toBe(true);
  expect(stableTitle.every((sample) => sample.visibility === "visible")).toBe(
    true,
  );
  expect(new Set(stableTitle.map((sample) => sample.clip)).size).toBe(1);
  expect(new Set(stableTitle.map((sample) => sample.transform)).size).toBe(1);
});

test("the light changes the illumination of the background as the pointer moves", async ({
  page,
}) => {
  await page.goto("/");
  const illumination = () =>
    page.locator(".hero-field").evaluate((canvas) => {
      const ratio = canvas.width / innerWidth;
      const pixels = canvas
        .getContext("2d")
        .getImageData(140 * ratio, 210 * ratio, 40 * ratio, 40 * ratio).data;
      let light = 0;
      for (let i = 0; i < pixels.length; i += 4)
        light += (pixels[i + 1] * pixels[i + 3]) / 255;
      return light / (pixels.length / 4);
    });
  await page.mouse.move(160, 230);
  await expect.poll(illumination).toBeGreaterThan(10);
  const near = await illumination();
  await page.mouse.move(1110, 520);
  await expect.poll(illumination).toBeLessThan(near * 0.5);
});

test("Birmingham photos advance slowly, pause during interaction, and respect reduced motion", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.clock.install();
  await page.goto("/#community");
  const gallery = page.locator("[data-event-gallery]");
  const buttons = page.locator("[data-event-select]");
  await gallery.scrollIntoViewIfNeeded();
  await page.clock.runFor(8200);
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-event-status]")).toBeEmpty();
  await gallery.hover();
  await page.clock.runFor(15000);
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(10, 120);
  await page.clock.runFor(8200);
  await expect(buttons.nth(2)).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(15000);
  await expect(buttons.nth(2)).toHaveAttribute("aria-pressed", "true");
  await buttons.nth(0).click();
  await expect(buttons.nth(0)).toHaveAttribute("aria-pressed", "true");
});

for (const [slug, name] of [
  ["themis", "Themis"],
  ["dueform", "DueForm"],
  ["actifact", "ActiFact"],
  ["financial-qa", "Financial document QA"],
  ["vodafone-tobi", "Vodafone TOBi"],
  ["nationwide-governance", "Nationwide AI Governance"],
]) {
  test(`${name}: outside click and Escape return to the actual previous page`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      document.addEventListener("portfolio-transition", (event) => {
        if (
          event.detail.phase === "leaving" &&
          event.detail.direction === "close"
        )
          sessionStorage.setItem(
            "tested-close-duration",
            String(event.detail.duration),
          );
      });
    });
    await page.goto("/projects.html");
    const card = page.getByRole("link", {
      name: `Read case study: ${name}`,
      exact: true,
    });
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${slug}.html$`));
    await page.locator(".scene.is-active .scene-title").click();
    await expect(page).toHaveURL(new RegExp(`${slug}.html$`));
    const backdrop = await page.locator(".presentation-topbar").boundingBox();
    await page.mouse.click(
      backdrop.x + backdrop.width * 0.55,
      backdrop.y + backdrop.height / 2,
    );
    await expect(page).toHaveURL(/projects.html$/);
    await expect(card).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Number(sessionStorage.getItem("tested-close-duration")),
        ),
      )
      .toBe(460);
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${slug}.html$`));
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/projects.html$/);
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${slug}.html$`));
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/projects.html$/);
  });
}

test("direct project links have a safe return and old links retain their scene", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/actifact.html");
  await page.locator(".scene.is-active .scene-title").click();
  await page.mouse.click(8, 200);
  await expect(page).toHaveURL(/index.html#work$/);
  await page.goto("/billacord.html#results");
  await expect(page).toHaveURL(/dueform.html#results$/);
  await expect(page.locator("#results")).toBeVisible();
  await page.goto("/actionproof.html?view=all#build");
  await expect(page).toHaveURL(/actifact.html\?view=all#build$/);
  await expect(page.locator(".scene:visible")).toHaveCount(6);
  await context.close();
});

for (const slug of [
  "themis",
  "dueform",
  "actifact",
  "financial-qa",
  "vodafone-tobi",
  "nationwide-governance",
]) {
  test(`${slug}: electrical stages travel in both directions and stay connected on mobile`, async ({
    page,
  }) => {
    await page.goto(`/${slug}.html#architecture`);
    const track = page.locator(".stage-track");
    await expect(page.locator(".stage-wire")).toHaveCount(3);
    const signals = () =>
      page.locator(".stage-current").evaluateAll((paths) =>
        paths.flatMap((path) =>
          path.getAnimations().map((animation) => {
            const frames = animation.effect.getKeyframes();
            return {
              from: parseFloat(frames[0].strokeDashoffset),
              to: parseFloat(frames.at(-1).strokeDashoffset),
              delay: animation.effect.getTiming().delay,
            };
          }),
        ),
      );
    await page.locator('[data-stage="3"]').click();
    expect(await signals()).toEqual([
      { from: 28, to: -100, delay: 0 },
      { from: 28, to: -100, delay: 520 },
      { from: 28, to: -100, delay: 1040 },
    ]);
    await expect(page.locator("#stage-panel-3")).toBeVisible();
    await page.locator('[data-stage="0"]').click();
    expect(await signals()).toEqual([
      { from: -100, to: 28, delay: 1040 },
      { from: -100, to: 28, delay: 520 },
      { from: -100, to: 28, delay: 0 },
    ]);
    await expect(track).toHaveAttribute("data-direction", "reverse");
    expect(
      await page
        .locator('[data-stage="0"] .stage-charge')
        .evaluate((rect) => getComputedStyle(rect).animationDirection),
    ).toBe("reverse");
    for (const width of [1440, 760, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(
          () =>
            track.evaluate((track) => {
              const box = track.getBoundingClientRect();
              const svg = track.querySelector(".stage-wires");
              if (Math.abs(svg.viewBox.baseVal.width - box.width) > 1)
                return false;
              const buttons = [...track.querySelectorAll(".stage-button")].map(
                (button) => button.getBoundingClientRect(),
              );
              return [...svg.querySelectorAll(".stage-wire")].every(
                (wire, i) => {
                  const length = wire.getTotalLength();
                  const start = wire.getPointAtLength(0);
                  const end = wire.getPointAtLength(length);
                  const from = buttons[i],
                    to = buttons[i + 1];
                  const sameRow = Math.abs(from.top - to.top) < 2;
                  const expectedStart = sameRow
                    ? [from.right, (from.top + from.bottom) / 2]
                    : [(from.left + from.right) / 2, from.bottom];
                  const expectedEnd = sameRow
                    ? [to.left, (to.top + to.bottom) / 2]
                    : [(to.left + to.right) / 2, to.top];
                  if (
                    Math.hypot(
                      start.x + box.left - expectedStart[0],
                      start.y + box.top - expectedStart[1],
                    ) > 1 ||
                    Math.hypot(
                      end.x + box.left - expectedEnd[0],
                      end.y + box.top - expectedEnd[1],
                    ) > 1
                  )
                    return false;
                  for (let n = 1; n < 20; n++) {
                    const point = wire.getPointAtLength((length * n) / 20);
                    const x = point.x + box.left,
                      y = point.y + box.top;
                    if (
                      buttons.some(
                        (button) =>
                          x > button.left + 1 &&
                          x < button.right - 1 &&
                          y > button.top + 1 &&
                          y < button.bottom - 1,
                      )
                    )
                      return false;
                  }
                  return true;
                },
              );
            }),
          `Connected wires at ${width}px`,
        )
        .toBe(true);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator('[data-stage="2"]').click();
    await expect(page.locator("#stage-panel-2")).toBeVisible();
    expect(await signals()).toEqual([]);
    expect(
      await page
        .locator(".stage-charge")
        .evaluateAll((rects) =>
          rects.every(
            (rect) =>
              getComputedStyle(rect).animationName === "none" &&
              getComputedStyle(rect).opacity === "0",
          ),
        ),
    ).toBeTruthy();
  });
}

test("the reflective sweep covers the full overview visual at every breakpoint", async ({
  page,
}) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/themis.html");
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-page-transition",
      /^(entering|leaving)$/,
    );
    if (width < 981) {
      await expect(page.locator(".intro-visual")).toBeHidden();
      await page
        .getByRole("button", { name: "Read all at once", exact: true })
        .click();
      await expect(page.locator(".intro-visual")).toBeVisible();
    }
    expect(
      await page.locator(".intro-visual").evaluate((visual) => {
        const sheen = getComputedStyle(visual, "::after");
        const bounds = visual.getBoundingClientRect();
        return (
          Math.abs(parseFloat(sheen.width) - (bounds.width - 2)) < 1 &&
          Math.abs(parseFloat(sheen.height) - (bounds.height - 2)) < 1 &&
          sheen.inset === "0px" &&
          sheen.transform === "none"
        );
      }),
      `Full reflective surface at ${width}px`,
    ).toBeTruthy();
  }
});

test("the background glow stays smooth across the space below the video frame", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const frame = await page.locator(".portrait-panel").boundingBox();
  const y = frame.y + frame.height + 40;
  for (const edge of [frame.x, frame.x + frame.width]) {
    await page.mouse.move(edge === frame.x ? edge + 90 : edge - 90, y);
    await expect
      .poll(() =>
        page.locator(".hero-field").evaluate(
          (canvas, point) => {
            const ratio = canvas.width / innerWidth;
            const pixels = canvas
              .getContext("2d")
              .getImageData(point.x * ratio, point.y * ratio, 1, 1).data;
            return (pixels[1] * pixels[3]) / 255;
          },
          { x: edge, y },
        ),
      )
      .toBeGreaterThan(10);
    const screenshot = await page.screenshot();
    const jump = await page.evaluate(
      async ({ bytes, edge, y }) => {
        const image = await createImageBitmap(
          new Blob([Uint8Array.from(bytes)], { type: "image/png" }),
        );
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const green = (x, sampleY) => {
          const pixels = context.getImageData(
            Math.floor(x),
            Math.floor(sampleY - 6),
            8,
            12,
          ).data;
          let total = 0;
          for (let i = 1; i < pixels.length; i += 4) total += pixels[i];
          return total / (pixels.length / 4);
        };
        const differences = [-18, 0, 18, 36, 54]
          .map(
            (offset) =>
              green(edge - 12, y + offset) - green(edge + 4, y + offset),
          )
          .sort((a, b) => a - b);
        const difference = Math.abs(differences[2]);
        image.close();
        return difference;
      },
      { bytes: [...screenshot], edge, y },
    );
    expect(
      jump,
      `No rectangular light boundary below the frame at x=${edge}`,
    ).toBeLessThan(8);
  }
});

test("keyboard shortcuts open a panel, jump between chapters, and Escape only closes the panel", async ({
  page,
}) => {
  await page.goto("/themis.html");
  await expect(page.locator(".presentation-deck")).toBeVisible();
  await page.keyboard.press("?");
  const panel = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Move between scenes")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(/themis.html/);
  await page.goto("/");
  await page.keyboard.press("g");
  await page.keyboard.press("e");
  await expect
    .poll(() =>
      page
        .locator("#experience")
        .evaluate((section) => Math.round(section.getBoundingClientRect().top)),
    )
    .toBeLessThan(200);
  await page.getByRole("button", { name: /for shortcuts/ }).click();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Close shortcuts" }).click();
  await expect(panel).toBeHidden();
});

test("note rows preview their summary beside the pointer", async ({ page }) => {
  await page.goto("/blog_homepage.html");
  const row = page.locator(".note-row").first();
  await row.hover();
  const preview = page.locator(".note-preview");
  await expect(preview).toHaveClass(/is-visible/);
  await expect(preview).toContainText("A complete walkthrough");
  await expect(preview).toContainText(/\d+ sections · \d+ min read/);
  await page.mouse.move(10, 10);
  await expect(preview).not.toHaveClass(/is-visible/);
});

test("the hero name responds to the pointer and keeps its accessible name", async ({
  page,
}) => {
  await page.goto("/#work");
  await page.evaluate(() => window.scrollTo(0, 0));
  const heading = page.getByRole("heading", {
    level: 1,
    name: "Owen Le. Engineer.",
  });
  await expect(heading).toBeVisible();
  const accent = await page.locator(".hero-accent").boundingBox();
  for (let step = 0; step < 6; step++)
    await page.mouse.move(
      accent.x + accent.width * (0.3 + step * 0.04),
      accent.y + accent.height / 2,
    );
  await expect
    .poll(() =>
      page
        .locator(".hero h1 .line span span")
        .evaluateAll((glyphs) =>
          Math.max(0, ...glyphs.map((glyph) => Number(glyph.style.fontWeight))),
        ),
    )
    .toBeGreaterThan(560);
  await page.mouse.move(10, 860);
  await expect(page.locator(".hero h1 .line span span")).toHaveCount(0);
  await expect(page.locator(".hero h1")).toHaveText(/Owen Le\.\s+Engineer\./);
});

test("the Themis architecture opens as an accessible diagram and closes without leaving the project", async ({
  page,
}) => {
  await page.goto("/themis.html#architecture");
  await page.getByRole("button", { name: "Full architecture" }).click();
  const diagram = page.getByRole("dialog", {
    name: "How Themis grades an agent’s work.",
  });
  await expect(diagram).toBeVisible();
  await expect(diagram.locator(".diagram-group")).toHaveCount(7);
  await expect(
    diagram.getByText("Environment-aligned execution"),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .include(".diagram-dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations.map((violation) => violation.id)).toEqual([]);
  await diagram.getByText("Structured judgement").click();
  await expect(diagram).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(diagram).toBeHidden();
  await expect(page).toHaveURL(/themis.html#architecture$/);
});
