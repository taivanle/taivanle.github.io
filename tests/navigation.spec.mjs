import { test, expect } from "@playwright/test";

test("Escape unwinds chained projects and returns to Work", async ({
  page,
}) => {
  await page.goto("/index.html#work");
  await page
    .getByRole("link", { name: "Read case study: Themis", exact: true })
    .click();
  await expect(page).toHaveURL(/themis.html$/);
  await page
    .getByRole("button", { name: "Scene 6: Perspective", exact: true })
    .click();
  await expect(page).toHaveURL(/themis.html#scope$/);
  const previousProjectUrl = page.url();
  await page.getByRole("link", { name: /Next project.*DueForm/ }).click();
  await expect(page).toHaveURL(/dueform.html$/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(previousProjectUrl);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-page-transition",
    /^(entering|leaving)$/,
  );
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/index.html#work$/);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-page-transition",
    /^(entering|leaving)$/,
  );
});

test("Escape after a project reload still leaves the project", async ({
  page,
}) => {
  await page.goto("/index.html#work");
  await page
    .getByRole("link", { name: "Read case study: Themis", exact: true })
    .click();
  await expect(page).toHaveURL(/themis.html$/);
  await page.reload();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/index.html#work$/);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-page-transition",
    /^(entering|leaving)$/,
  );
  expect(
    await page
      .locator("body")
      .evaluate((body) => getComputedStyle(body).backgroundColor),
  ).toBe("rgb(12, 28, 26)");
});

test("Escape refreshes an older source page instead of restoring its cached scripts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.documentVersionId = `${Date.now()}:${Math.random()}`;
  });
  await page.route("**/index.html", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      /<script>\s*\/\/ Install navigation[\s\S]*?<\/script>/,
      "",
    );
    await route.fulfill({ response, body });
    await page.unroute("**/index.html");
  });
  await page.goto("/index.html#work");
  const originalDocument = await page.evaluate(() => window.documentVersionId);
  await page
    .getByRole("link", { name: "Read case study: ActiFact", exact: true })
    .click();
  await expect(page).toHaveURL(/actifact.html$/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/index.html#work$/);
  expect(await page.evaluate(() => window.documentVersionId)).not.toBe(
    originalDocument,
  );
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-page-transition",
    /^(entering|leaving)$/,
  );
  await expect(
    page.getByRole("link", { name: "Read case study: ActiFact", exact: true }),
  ).toBeVisible();
});

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

test("a deferred script finishing during Escape cannot cancel the project exit", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (
        window.rejectClosingMarker &&
        key === "portfolio-navigation-transition" &&
        JSON.parse(value).direction === "close"
      )
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
    document.addEventListener("portfolio-transition", (event) => {
      if (
        event.detail.phase === "entering" &&
        event.detail.direction === "open" &&
        location.pathname === "/themis.html"
      ) {
        const stage = document.querySelector(".navigation-flip-stage");
        const rotor = stage?.querySelector(".navigation-card-rotor");
        sessionStorage.setItem(
          "tested-deferred-arrival",
          JSON.stringify({
            duration: event.detail.duration,
            readyState: document.readyState,
            inert: stage?.inert,
            hidden: stage?.getAttribute("aria-hidden"),
            rotation: rotor
              ?.getAnimations()[0]
              ?.effect.getKeyframes()
              .map((frame) => frame.transform),
          }),
        );
      }
      if (
        event.detail.phase === "leaving" &&
        event.detail.direction === "close"
      )
        sessionStorage.setItem(
          "tested-deferred-exit",
          JSON.stringify({
            duration: event.detail.duration,
            phase: document.documentElement.dataset.pageTransition,
            source: location.pathname,
            destinationFrame: Boolean(
              JSON.parse(
                sessionStorage.getItem("portfolio-navigation-transition"),
              )?.exitFrame,
            ),
            destinationFlip: Boolean(
              JSON.parse(
                sessionStorage.getItem("portfolio-navigation-transition"),
              )?.flip,
            ),
            coverOpacity: document.getElementById("navigation-cover")
              ? Number(
                  getComputedStyle(document.getElementById("navigation-cover"))
                    .opacity,
                )
              : 0,
          }),
        );
    });
    document.addEventListener("DOMContentLoaded", () => {
      if (window.rejectClosingMarker)
        sessionStorage.setItem(
          "tested-deferred-completion",
          JSON.stringify({
            phase: document.documentElement.dataset.pageTransition,
            appReady: document.documentElement.classList.contains("js"),
          }),
        );
    });
  });

  for (const storageUnavailable of [false, true]) {
    await page.goto("/projects.html");
    await page.evaluate(() => {
      sessionStorage.removeItem("tested-deferred-exit");
      sessionStorage.removeItem("tested-deferred-completion");
      sessionStorage.removeItem("tested-deferred-arrival");
    });
    let release;
    let intercept;
    const held = new Promise((resolve) => (release = resolve));
    const intercepted = new Promise((resolve) => (intercept = resolve));
    const holdApp = async (route) => {
      if (route.request().headers().referer?.includes("/themis.html")) {
        intercept();
        await held;
      }
      await route.continue().catch(() => {});
    };
    await page.route("**/assets/app.js*", holdApp);
    try {
      await page
        .getByRole("link", { name: "Read case study: Themis", exact: true })
        .click({ noWaitAfter: true });
      await page.waitForURL(/themis.html$/, { waitUntil: "commit" });
      await intercepted;
      await expect(page.locator(".presentation-deck")).toBeAttached();
      expect(
        (await page.locator("html").getAttribute("class")) || "",
      ).not.toContain("js");
      const stage = page.locator(".navigation-flip-stage");
      await expect(stage).toBeAttached();
      await expect
        .poll(
          () =>
            stage.evaluate(
              (element) =>
                element
                  .getAnimations({ subtree: true })
                  .filter(
                    (animation) =>
                      animation.playState === "running" || animation.pending,
                  ).length,
            ),
          { timeout: 8000 },
        )
        .toBe(0);
      const heldState = await page.evaluate(() => {
        const rotor = document.querySelector(".navigation-card-rotor");
        const back = document.querySelector(".navigation-card-back");
        const upright = new DOMMatrix(
          getComputedStyle(rotor).transform,
        ).multiply(new DOMMatrix(getComputedStyle(back).transform));
        const progress = new DOMMatrix(
          getComputedStyle(
            document.querySelector(".navigation-card-progress-fill"),
          ).transform,
        ).a;
        const field = document.querySelector(".hero-field");
        return {
          bootstrap: JSON.parse(
            sessionStorage.getItem("tested-deferred-arrival"),
          ),
          upright: {
            m22: upright.m22,
            m23: upright.m23,
            m32: upright.m32,
            m33: upright.m33,
          },
          progress,
          mainFilter: getComputedStyle(document.querySelector("main")).filter,
          fieldFilter: getComputedStyle(field).filter,
          fieldOpacity: Number(getComputedStyle(field).opacity),
          coverOpacity: document.getElementById("navigation-cover")
            ? Number(
                getComputedStyle(document.getElementById("navigation-cover"))
                  .opacity,
              )
            : 0,
          phase: document.documentElement.dataset.pageTransition,
        };
      });
      expect(heldState.bootstrap).toEqual({
        duration: 390,
        readyState: "loading",
        inert: true,
        hidden: "true",
        rotation: ["rotateX(135deg)", "rotateX(180deg)"],
      });
      expect(heldState.upright.m22).toBeCloseTo(1, 3);
      expect(heldState.upright.m33).toBeCloseTo(1, 3);
      expect(heldState.upright.m23).toBeCloseTo(0, 3);
      expect(heldState.upright.m32).toBeCloseTo(0, 3);
      expect(heldState.progress).toBeGreaterThanOrEqual(0.85);
      expect(heldState.progress).toBeLessThan(1);
      expect(heldState.mainFilter).toBe("blur(8px)");
      expect(heldState.fieldFilter).toBe("none");
      expect(heldState.fieldOpacity).toBeGreaterThan(0);
      expect(heldState.coverOpacity).toBe(0);
      expect(heldState.phase).toBe("entering");
      expect(
        await page.evaluate(async () => {
          const field = document.querySelector(".hero-field");
          const sample = document.createElement("canvas");
          sample.width = sample.height = 64;
          const context = sample.getContext("2d");
          function pixels() {
            context.clearRect(0, 0, 64, 64);
            context.drawImage(field, 0, 0, 64, 64);
            return Array.from(context.getImageData(0, 0, 64, 64).data).join(
              ",",
            );
          }
          const before = pixels();
          const until = performance.now() + 180;
          do {
            await new Promise(requestAnimationFrame);
          } while (performance.now() < until);
          return before !== pixels();
        }),
      ).toBe(true);
      // The loading card stays present until the blocked deferred app is ready.
      await expect(stage).toBeAttached();
      await expect(page.locator(".navigation-card-scan")).toHaveCount(0);
      await page.evaluate((unavailable) => {
        window.rejectClosingMarker = unavailable;
      }, storageUnavailable);
      await page.keyboard.press("Escape");
      if (storageUnavailable)
        await expect(page.locator("html")).toHaveAttribute(
          "data-page-transition",
          "leaving",
        );
      // Normal closing continues the flip on the landing page. When storage
      // fails, the source animates instead; releasing the deferred app while
      // either exit is active must not cancel it.
      release();
      await expect(page).toHaveURL(/projects.html$/);
      await expect(page.locator("html")).not.toHaveAttribute(
        "data-page-transition",
        /^(entering|leaving)$/,
      );
      await expect(page.locator("html")).not.toHaveAttribute(
        "data-cover-ready",
        "true",
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
      await expect(
        page.getByRole("link", {
          name: "Read case study: Themis",
          exact: true,
        }),
      ).toBeVisible();
      const result = await page.evaluate(() => ({
        exit: JSON.parse(sessionStorage.getItem("tested-deferred-exit")),
        completion: JSON.parse(
          sessionStorage.getItem("tested-deferred-completion"),
        ),
        colors: [
          getComputedStyle(document.documentElement).backgroundColor,
          getComputedStyle(document.body).backgroundColor,
        ],
        cover: document.getElementById("navigation-cover")
          ? {
              opacity: getComputedStyle(
                document.getElementById("navigation-cover"),
              ).opacity,
              pointerEvents: getComputedStyle(
                document.getElementById("navigation-cover"),
              ).pointerEvents,
            }
          : null,
      }));
      expect(result.exit).toEqual({
        duration: storageUnavailable ? 550 : 220,
        phase: "leaving",
        source: "/themis.html",
        destinationFrame: !storageUnavailable,
        destinationFlip: !storageUnavailable,
        coverOpacity: 0,
      });
      if (storageUnavailable)
        expect(result.completion).toEqual({
          phase: "leaving",
          appReady: true,
        });
      expect(result.colors).toEqual(["rgb(12, 28, 26)", "rgb(12, 28, 26)"]);
      if (result.cover)
        expect(result.cover).toEqual({ opacity: "0", pointerEvents: "none" });
    } finally {
      release();
      await page.unroute("**/assets/app.js*", holdApp);
    }
  }
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
