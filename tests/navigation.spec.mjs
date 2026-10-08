import { test, expect } from "@playwright/test";

test("Escape returns before the deferred project script has loaded", async ({
  page,
}) => {
  await page.goto("/projects.html");
  let release;
  let intercept;
  const held = new Promise((resolve) => (release = resolve));
  const intercepted = new Promise((resolve) => (intercept = resolve));
  await page.route("**/assets/app.js*", async (route) => {
    if (route.request().headers().referer?.includes("/actifact.html")) {
      intercept();
      await held;
    }
    await route.continue().catch(() => {});
  });
  try {
    await page
      .getByRole("link", { name: "Read case study: ActiFact", exact: true })
      .click({ noWaitAfter: true });
    await page.waitForURL(/actifact.html$/, { waitUntil: "commit" });
    await intercepted;
    expect(
      (await page.locator("html").getAttribute("class")) || "",
    ).not.toContain("js");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/projects.html$/);
  } finally {
    release();
  }
});

test("the first Escape closes the project menu and the next Escape returns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects.html");
  await page
    .getByRole("link", { name: "Read case study: DueForm", exact: true })
    .click();
  await expect(page).toHaveURL(/dueform.html$/);
  await expect(page.locator(".presentation-shell")).toBeFocused();
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/dueform.html$/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/projects.html$/);
});

test("direct projects stay dark and can exit even without external styles or scripts", async ({
  browser,
}) => {
  for (const slug of ["themis", "dueform", "actifact"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route(/\/assets\/(?:styles\.css|app\.js)(?:\?|$)/, (route) =>
      route.abort(),
    );
    await page.goto(`http://127.0.0.1:4178/${slug}.html`);
    const colors = await page.evaluate(() => [
      getComputedStyle(document.documentElement).backgroundColor,
      getComputedStyle(document.body).backgroundColor,
      getComputedStyle(document.documentElement).colorScheme,
    ]);
    expect(colors).toEqual(["rgb(12, 28, 26)", "rgb(12, 28, 26)", "dark"]);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/index.html#work$/);
    await context.close();
  }
});

test("project entry and return keep an opaque dark backing throughout native transitions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    addEventListener("pagereveal", (event) => {
      window.transitionReady = false;
      if (!event.viewTransition) return;
      event.viewTransition.ready
        .then(() => {
          window.transitionAnimations = document
            .getAnimations()
            .filter((animation) =>
              animation.effect?.pseudoElement?.startsWith("::view-transition"),
            );
          window.transitionAnimations.forEach((animation) => animation.pause());
          window.transitionReady = true;
        })
        .catch(() => {});
    });
  });

  async function inspectFrames() {
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(
            window.transitionReady &&
            window.transitionAnimations?.some(
              (animation) => animation.playState === "paused",
            ),
          ),
        ),
      )
      .toBe(true);
    expect(
      await page.evaluate(() => window.transitionAnimations.length),
    ).toBeGreaterThan(0);
    for (const progress of [0.05, 0.5, 0.95]) {
      const backing = await page.evaluate(async (progress) => {
        window.transitionAnimations.forEach((animation) => {
          animation.currentTime =
            animation.effect.getTiming().duration * progress;
        });
        await new Promise(requestAnimationFrame);
        const root = document.documentElement;
        return {
          background: getComputedStyle(root, "::view-transition")
            .backgroundColor,
          outgoingOpacity: getComputedStyle(root, "::view-transition-old(root)")
            .opacity,
          outgoingBlend: getComputedStyle(root, "::view-transition-old(root)")
            .mixBlendMode,
          incomingBlend: getComputedStyle(root, "::view-transition-new(root)")
            .mixBlendMode,
        };
      }, progress);
      expect(backing).toEqual({
        background: "rgb(12, 28, 26)",
        outgoingOpacity: "1",
        outgoingBlend: "normal",
        incomingBlend: "normal",
      });
      const screenshot = await page.screenshot();
      const gutterBrightness = await page.evaluate(
        async (bytes) => {
          const image = await createImageBitmap(
            new Blob([Uint8Array.from(bytes)], { type: "image/png" }),
          );
          const canvas = new OffscreenCanvas(image.width, image.height);
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          const brightness = (x) => {
            const pixels = context.getImageData(
              x,
              Math.floor(image.height / 2),
              8,
              8,
            ).data;
            let total = 0;
            for (let i = 0; i < pixels.length; i += 4)
              total += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
            return total / (pixels.length / 4);
          };
          const result = [brightness(2), brightness(image.width - 10)];
          image.close();
          return result;
        },
        [...screenshot],
      );
      for (const value of gutterBrightness) expect(value).toBeLessThan(90);
    }
    await page.evaluate(() =>
      window.transitionAnimations.forEach((animation) => animation.finish()),
    );
  }

  await page.goto("/projects.html");
  for (const [slug, name] of [
    ["themis", "Themis"],
    ["dueform", "DueForm"],
    ["actifact", "ActiFact"],
  ]) {
    await page
      .getByRole("link", { name: `Read case study: ${name}`, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${slug}.html$`));
    await inspectFrames();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/projects.html$/);
    await inspectFrames();
  }
});
