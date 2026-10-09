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
      if (event.detail.phase === "leaving") {
        const stage = document.querySelector(".navigation-flip-stage");
        const rotor = stage?.querySelector(".navigation-card-rotor");
        const geometry = stage?.getAnimations()[0];
        if (geometry && rotor) {
          const layout = () => ({
            left: stage.style.left,
            top: stage.style.top,
            width: stage.style.width,
            height: stage.style.height,
          });
          const marker = JSON.parse(
            sessionStorage.getItem("portfolio-navigation-transition"),
          );
          const motion = {
            duration: event.detail.duration,
            rotation: rotor
              .getAnimations()[0]
              ?.effect.getKeyframes()
              .map((frame) => frame.transform),
            geometry: geometry.effect
              .getKeyframes()
              .map((frame) =>
                Object.keys(frame).filter(
                  (property) =>
                    ![
                      "offset",
                      "computedOffset",
                      "easing",
                      "composite",
                    ].includes(property),
                ),
              ),
            before: layout(),
            rect: marker?.flip?.rect,
            target: marker?.flip?.target,
          };
          geometry.finished
            .then(() => {
              sessionStorage.setItem(
                `tested-deferred-source-${event.detail.direction}`,
                JSON.stringify({ ...motion, after: layout() }),
              );
            })
            .catch(() => {});
        }
      }
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
      sessionStorage.removeItem("tested-deferred-source-open");
      sessionStorage.removeItem("tested-deferred-source-close");
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
                      !animation.effect.target.classList.contains(
                        "navigation-card-progress-fill",
                      ) &&
                      (animation.playState === "running" || animation.pending),
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
          source: JSON.parse(
            sessionStorage.getItem("tested-deferred-source-open"),
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
        duration: 250,
        readyState: "loading",
        inert: true,
        hidden: "true",
        rotation: ["rotateX(180deg)", "rotateX(180deg)"],
      });
      // The full flip finishes on the source page. Its geometry is fixed;
      // only compositor transforms move it, so deferred page loading cannot
      // split or restart the rotation midway through.
      expect(heldState.source.duration).toBe(520);
      expect(heldState.source.rotation).toEqual([
        "rotateX(0deg)",
        "rotateX(180deg)",
      ]);
      expect(heldState.source.geometry).toEqual([["transform"], ["transform"]]);
      expect(heldState.source.after).toEqual(heldState.source.before);
      for (const property of ["x", "y", "width", "height"])
        expect(heldState.source.rect[property]).toBe(
          heldState.source.target[property],
        );
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
      const buffering = await page.evaluate(async () => {
        const field = document.querySelector(".hero-field");
        const fill = document.querySelector(".navigation-card-progress-fill");
        const progress = () =>
          new DOMMatrix(getComputedStyle(fill).transform).a;
        const sample = document.createElement("canvas");
        sample.width = sample.height = 64;
        const context = sample.getContext("2d");
        function pixels() {
          context.clearRect(0, 0, 64, 64);
          context.drawImage(field, 0, 0, 64, 64);
          return Array.from(context.getImageData(0, 0, 64, 64).data).join(",");
        }
        const before = pixels();
        const progressBefore = progress();
        const until = performance.now() + 180;
        do {
          await new Promise(requestAnimationFrame);
        } while (performance.now() < until);
        return {
          fieldMoves: before !== pixels(),
          progressBefore,
          progressAfter: progress(),
        };
      });
      expect(buffering.fieldMoves).toBe(true);
      expect(buffering.progressAfter).toBeGreaterThanOrEqual(
        buffering.progressBefore,
      );
      expect(buffering.progressAfter).toBeLessThan(1);
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
      // Normal closing completes the reverse flip on the source page before
      // returning. Releasing the deferred app during that motion, or during
      // the storage fallback, must not cancel the exit.
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
        source: JSON.parse(
          sessionStorage.getItem("tested-deferred-source-close"),
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
        duration: storageUnavailable ? 550 : 460,
        phase: "leaving",
        source: "/themis.html",
        destinationFrame: !storageUnavailable,
        destinationFlip: !storageUnavailable,
        coverOpacity: 0,
      });
      if (!storageUnavailable) {
        expect(result.source.duration).toBe(460);
        expect(result.source.rotation).toEqual([
          "rotateX(0deg)",
          "rotateX(-180deg)",
        ]);
        expect(result.source.geometry).toEqual([["transform"], ["transform"]]);
        expect(result.source.after).toEqual(result.source.before);
      }
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
