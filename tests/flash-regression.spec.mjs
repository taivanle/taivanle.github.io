import { test, expect } from "@playwright/test";

const dark = "rgb(12, 28, 26)";
const projects = [
  { slug: "themis", name: "Themis", next: "dueform" },
  { slug: "dueform", name: "DueForm", next: "actifact" },
  { slug: "actifact", name: "ActiFact", next: "themis" },
];
const origins = [
  {
    name: "landing Work",
    path: "/index.html#work",
    url: /\/index\.html#work$/,
  },
  { name: "Projects", path: "/projects.html", url: /\/projects\.html$/ },
];

// Keep probes in the test process: a new document and a BFCache restore must
// contribute to the same timeline, including the frames before DOM readiness.
async function installProbe(page) {
  const records = [];
  await page.exposeBinding("__reportFlashProbe", (_source, record) => {
    records.push(record);
  });
  await page.addInitScript(() => {
    let running = false;
    let frame;
    function report(record) {
      window
        .__reportFlashProbe({
          time: Date.now(),
          href: location.href,
          ...record,
        })
        .catch(() => {});
    }
    function sample() {
      if (!running) return;
      const root = document.documentElement;
      // addInitScript precedes the critical inline style itself. Start asserting
      // at the first renderable document with that style, not at about:blank.
      if (root && document.head?.querySelector("style")) {
        const body = document.body;
        let video = null;
        if (body?.classList.contains("home-page")) {
          const portrait = body.querySelector("video[data-portrait-video]");
          if (portrait && getComputedStyle(portrait).visibility !== "hidden") {
            const rect = portrait.getBoundingClientRect();
            const left = Math.max(0, rect.left);
            const top = Math.max(0, rect.top);
            const right = Math.min(innerWidth, rect.right);
            const bottom = Math.min(innerHeight, rect.bottom);
            if (right > left && bottom > top)
              video = { left, top, right, bottom };
          }
        }
        report({
          kind: "sample",
          root: getComputedStyle(root).backgroundColor,
          body: body ? getComputedStyle(body).backgroundColor : null,
          phase: root.dataset.pageTransition || null,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          video,
        });
      }
      frame = requestAnimationFrame(sample);
    }
    function start() {
      if (running) return;
      running = true;
      sample();
    }
    window.addEventListener(
      "portfolio-transition",
      (event) => {
        report({ kind: "transition", ...event.detail });
      },
      true,
    );
    window.addEventListener("pageshow", (event) => {
      report({ kind: "pageshow", persisted: event.persisted });
      start();
    });
    window.addEventListener("pagehide", () => {
      running = false;
      cancelAnimationFrame(frame);
    });
    // Start before DOMContentLoaded so delayed assets do not leave the first
    // paint outside the probe. sample() waits for the inline critical style.
    start();
  });
  return records;
}

async function analyseFrames(page, frames, records) {
  const samples = records.filter((record) => record.kind === "sample");
  const encoded = frames.map((frame) => {
    const closest = samples.reduce(
      (best, sample) =>
        !best ||
        Math.abs(sample.time - frame.timestamp) <
          Math.abs(best.time - frame.timestamp)
          ? sample
          : best,
      null,
    );
    return {
      data: frame.data.toString("base64"),
      timestamp: frame.timestamp,
      video: closest?.video || null,
      viewportWidth: closest?.viewportWidth || frame.viewportWidth,
      viewportHeight: closest?.viewportHeight || frame.viewportHeight,
    };
  });
  return page.evaluate(async (encoded) => {
    const results = [];
    for (const frame of encoded) {
      const image = new Image();
      image.src = `data:image/jpeg;base64,${frame.data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      // Only the visible natural portrait video is excluded. No central deck,
      // card, transition cover, header, or other page region is masked.
      const mask = frame.video && {
        left: (frame.video.left * canvas.width) / frame.viewportWidth,
        top: (frame.video.top * canvas.height) / frame.viewportHeight,
        right: (frame.video.right * canvas.width) / frame.viewportWidth,
        bottom: (frame.video.bottom * canvas.height) / frame.viewportHeight,
      };
      let bright = 0;
      let unmaskedBright = 0;
      let unmaskedPixels = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const offset = (y * canvas.width + x) * 4;
          const white =
            pixels[offset] >= 235 &&
            pixels[offset + 1] >= 235 &&
            pixels[offset + 2] >= 235;
          if (white) bright++;
          if (
            mask &&
            x >= mask.left &&
            x < mask.right &&
            y >= mask.top &&
            y < mask.bottom
          )
            continue;
          unmaskedPixels++;
          if (white) unmaskedBright++;
        }
      }
      results.push({
        timestamp: frame.timestamp,
        rawWhiteRatio: bright / (canvas.width * canvas.height),
        whiteRatio: unmaskedBright / unmaskedPixels,
        maskedRatio: 1 - unmaskedPixels / (canvas.width * canvas.height),
      });
    }
    return results;
  }, encoded);
}

async function attachFailure(info, label, records, frames, metrics, index) {
  await info.attach(`${label}-timeline.json`, {
    body: Buffer.from(JSON.stringify({ records, metrics }, null, 2)),
    contentType: "application/json",
  });
  const frame = frames[index] || frames.at(-1);
  if (frame)
    await info.attach(`${label}-frame.jpg`, {
      body: frame.data,
      contentType: "image/jpeg",
    });
}

async function recordJourney(page, records, label, action, url, selector) {
  const firstRecord = Math.max(0, records.length - 1);
  const frames = [];
  const viewport = page.viewportSize();
  const reducedMotion = await page.evaluate(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  let actionStarted;
  await page.screencast.start({
    onFrame: (frame) => {
      frames.push({ ...frame, receivedAt: Date.now() });
    },
    size: { width: Math.min(640, viewport.width), height: viewport.height },
    quality: 95,
  });
  try {
    await expect.poll(() => frames.length).toBeGreaterThan(0);
    actionStarted = Date.now();
    await action();
    await expect(page).toHaveURL(url);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(selector)).toBeVisible();
    await expect
      .poll(() =>
        records
          .slice(firstRecord)
          .some(
            (record) =>
              record.kind === "transition" &&
              record.phase === "settled" &&
              record.time >= actionStarted &&
              url.test(record.href),
          ),
      )
      .toBe(true);
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-page-transition",
      /^(leaving|entering)$/,
    );
    // Include restoration and cleanup paints after the final animation.
    await page.waitForTimeout(120);
  } catch (error) {
    await attachFailure(
      test.info(),
      label,
      records.slice(firstRecord),
      frames,
      [],
      -1,
    );
    throw error;
  } finally {
    await page.screencast.stop();
  }
  const timeline = records.slice(firstRecord);
  const metrics = await analyseFrames(page, frames, timeline);
  const brightIndex = metrics.findIndex((frame) => frame.whiteRatio > 0.25);
  const backgroundIssue = timeline.find(
    (record) =>
      record.kind === "sample" &&
      (record.root !== dark || (record.body !== null && record.body !== dark)),
  );
  const capturedAfterInput = frames.filter(
    (frame) => frame.receivedAt >= actionStarted,
  );
  const entering = timeline.some(
    (record) =>
      record.kind === "transition" &&
      record.phase === "entering" &&
      record.time >= actionStarted &&
      url.test(record.href),
  );
  // Reduced motion intentionally settles immediately, without an animated
  // entering phase. The destination settled event is still mandatory above.
  const arrivalObserved = entering || reducedMotion;
  if (
    brightIndex >= 0 ||
    backgroundIssue ||
    capturedAfterInput.length < 2 ||
    !arrivalObserved
  )
    await attachFailure(
      test.info(),
      label,
      timeline,
      frames,
      metrics,
      brightIndex,
    );
  expect(
    backgroundIssue,
    `${label}: root/body must remain dark on every sampled render`,
  ).toBeUndefined();
  expect(
    arrivalObserved,
    `${label}: capture must include destination arrival`,
  ).toBe(true);
  expect(
    capturedAfterInput.length,
    `${label}: require actual frames after input`,
  ).toBeGreaterThanOrEqual(2);
  expect(
    brightIndex,
    `${label}: no captured viewport may be more than 25% near-white`,
  ).toBe(-1);
  return timeline;
}

const card = (page, project) =>
  page.getByRole("link", {
    name: `Read case study: ${project.name}`,
    exact: true,
  });
const projectUrl = (project) => new RegExp(`/${project.slug}\\.html$`);

async function outsideClick(page) {
  const backdrop = await page.locator(".presentation-topbar").boundingBox();
  // Choose empty topbar space, outside the breadcrumb, title, and controls.
  await page.mouse.click(
    backdrop.x + backdrop.width * 0.55,
    backdrop.y + backdrop.height / 2,
  );
}

async function waitForDeckAnimations(page) {
  await expect
    .poll(
      () =>
        page.locator(".presentation-deck").evaluate(
          (deck) =>
            deck.getAnimations({ subtree: true }).filter((animation) => {
              const end = animation.effect?.getComputedTiming().endTime;
              // Decorative stage charges and diagrams deliberately loop. Scene
              // arrivals, stage hops, sweeps, and control transitions must finish.
              return (
                Number.isFinite(end) &&
                (animation.playState === "running" || animation.pending)
              );
            }).length,
        ),
      { intervals: [16, 40, 100], timeout: 8000 },
    )
    .toBe(0);
}

async function recordSceneJourney(page, records, label, action) {
  const firstRecord = Math.max(0, records.length - 1);
  const frames = [];
  const viewport = page.viewportSize();
  let actionStarted;
  await page.screencast.start({
    onFrame: (frame) => {
      frames.push({ ...frame, receivedAt: Date.now() });
    },
    size: { width: Math.min(640, viewport.width), height: viewport.height },
    quality: 95,
  });
  try {
    await expect.poll(() => frames.length).toBeGreaterThan(0);
    actionStarted = Date.now();
    await action();
    await waitForDeckAnimations(page);
    await expect(page.locator(".scene:visible")).toHaveCount(1);
    await page.waitForTimeout(120);
  } catch (error) {
    await attachFailure(
      test.info(),
      label,
      records.slice(firstRecord),
      frames,
      [],
      -1,
    );
    throw error;
  } finally {
    await page.screencast.stop();
  }
  const timeline = records.slice(firstRecord);
  const metrics = [];
  // A complete scene journey is longer than a navigation. Decode small batches
  // so CI does not have to load hundreds of JPEGs into one browser evaluation.
  for (let offset = 0; offset < frames.length; offset += 16)
    metrics.push(
      ...(await analyseFrames(
        page,
        frames.slice(offset, offset + 16),
        timeline,
      )),
    );
  const brightIndex = metrics.findIndex((frame) => frame.whiteRatio > 0.25);
  const backgroundIssue = timeline.find(
    (record) =>
      record.kind === "sample" &&
      (record.root !== dark || (record.body !== null && record.body !== dark)),
  );
  const capturedAfterInput = frames.filter(
    (frame) => frame.receivedAt >= actionStarted,
  );
  const maskIssue = metrics.some((frame) => frame.maskedRatio !== 0);
  if (
    brightIndex >= 0 ||
    backgroundIssue ||
    capturedAfterInput.length < 2 ||
    maskIssue
  )
    await attachFailure(
      test.info(),
      label,
      timeline,
      frames,
      metrics,
      brightIndex,
    );
  expect(
    backgroundIssue,
    `${label}: scene/control renders must keep dark root/body`,
  ).toBeUndefined();
  expect(
    maskIssue,
    `${label}: inspect the entire viewport including the deck`,
  ).toBe(false);
  expect(
    capturedAfterInput.length,
    `${label}: require actual interaction frames`,
  ).toBeGreaterThanOrEqual(2);
  expect(
    brightIndex,
    `${label}: no scene/control frame may be more than 25% near-white`,
  ).toBe(-1);
}

test.describe("flash regression", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const origin of origins) {
    for (const project of projects) {
      for (const exit of [
        "Escape",
        "outside click",
        "Selected work",
        "About",
        "Notes",
        "next project",
      ]) {
        test(`${origin.name} → ${project.name} → ${exit} stays dark`, async ({
          page,
        }) => {
          const records = await installProbe(page);
          await page.goto(origin.path);
          await recordJourney(
            page,
            records,
            "open",
            () => card(page, project).click(),
            projectUrl(project),
            ".presentation-deck",
          );
          let action;
          let url = origin.url;
          let selector = ".project-card";
          if (exit === "Escape") action = () => page.keyboard.press("Escape");
          else if (exit === "outside click") action = () => outsideClick(page);
          else if (exit === "Selected work") {
            action = () =>
              page.getByRole("link", { name: exit, exact: true }).click();
            url = /\/index\.html#work$/;
          } else if (exit === "About" || exit === "Notes") {
            action = () =>
              page
                .getByRole("navigation", { name: "Main navigation" })
                .getByRole("link", { name: exit, exact: true })
                .click();
            const section = exit.toLowerCase();
            url = new RegExp(`/index\\.html#${section}$`);
            selector = `#${section}`;
          } else {
            await page
              .getByRole("button", {
                name: "Scene 6: Perspective",
                exact: true,
              })
              .click();
            action = () =>
              page.getByRole("link", { name: /^Next project:/ }).click();
            url = new RegExp(`/${project.next}\\.html$`);
            selector = ".presentation-deck";
          }
          await recordJourney(page, records, "exit", action, url, selector);
        });
      }
    }
  }

  for (const origin of origins) {
    test(`${origin.name}: Escape during arrival stays dark`, async ({
      page,
    }) => {
      const records = await installProbe(page);
      await page.goto(origin.path);
      const project = projects[2];
      await recordJourney(
        page,
        records,
        "immediate-escape",
        async () => {
          await card(page, project).click({ noWaitAfter: true });
          await page.waitForURL(projectUrl(project), { waitUntil: "commit" });
          await expect(page.locator("html")).toHaveAttribute(
            "data-page-transition",
            "entering",
          );
          await page.keyboard.press("Escape");
        },
        origin.url,
        ".project-card",
      );
    });

    test(`${origin.name}: a BFCache return and repeated entry stay dark`, async ({
      page,
    }) => {
      const records = await installProbe(page);
      await page.goto(origin.path);
      const project = projects[1];
      await recordJourney(
        page,
        records,
        "first-open",
        () => card(page, project).click(),
        projectUrl(project),
        ".presentation-deck",
      );
      const returned = await recordJourney(
        page,
        records,
        "cached-return",
        () => page.keyboard.press("Escape"),
        origin.url,
        ".project-card",
      );
      expect(
        returned.some(
          (record) =>
            record.kind === "pageshow" &&
            record.persisted &&
            origin.url.test(record.href),
        ),
        "this journey must exercise a real BFCache restore",
      ).toBe(true);
      await recordJourney(
        page,
        records,
        "repeat-open",
        () => card(page, project).click(),
        projectUrl(project),
        ".presentation-deck",
      );
      await recordJourney(
        page,
        records,
        "repeat-return",
        () => page.keyboard.press("Escape"),
        origin.url,
        ".project-card",
      );
    });
  }

  for (const project of projects) {
    test(`direct ${project.name}: Escape fallback stays dark`, async ({
      page,
    }) => {
      const records = await installProbe(page);
      await page.goto(`/${project.slug}.html`);
      await recordJourney(
        page,
        records,
        "direct-return",
        () => page.keyboard.press("Escape"),
        /\/index\.html#work$/,
        ".project-card",
      );
    });

    test(`${project.name}: all scenes, internal controls, and reverse arrows stay dark`, async ({
      page,
    }) => {
      test.setTimeout(45000);
      // Compact presentation dimensions expose the real design/detail/build
      // controls; selecting hidden controls would miss their rendered states.
      await page.setViewportSize({ width: 760, height: 720 });
      const records = await installProbe(page);
      await page.goto(`/${project.slug}.html`);
      await expect(page.locator("html")).not.toHaveAttribute(
        "data-page-transition",
        /^(leaving|entering)$/,
      );
      const scenes = [
        "overview",
        "problem",
        "architecture",
        "build",
        "results",
        "scope",
      ];
      const sceneButtons = page.locator(".scene-menu [data-scene]");
      await expect(sceneButtons).toHaveCount(scenes.length);
      await recordSceneJourney(
        page,
        records,
        `inside-${project.slug}`,
        async () => {
          for (let index = 0; index < scenes.length; index++) {
            const scene = page.locator(`#${scenes[index]}`);
            await sceneButtons.nth(index).click();
            await expect(scene).toBeVisible();
            await expect(page.locator(".scene:visible")).toHaveCount(1);
            await expect(sceneButtons.nth(index)).toHaveAttribute(
              "aria-current",
              "step",
            );
            await waitForDeckAnimations(page);

            if (scenes[index] === "architecture") {
              for (const stage of [1, 2, 3, 0]) {
                const button = scene.locator(`[data-stage="${stage}"]`);
                await expect(button).toBeVisible();
                await button.click();
                await expect(button).toHaveAttribute("aria-pressed", "true");
                await expect(
                  scene.locator(`#stage-panel-${stage}`),
                ).toBeVisible();
                await waitForDeckAnimations(page);
              }
              const toggle = scene.locator(".design-toggle");
              await expect(toggle).toBeVisible();
              await toggle.click();
              await expect(toggle).toHaveAttribute("aria-pressed", "true");
              await expect(
                scene.locator(".presentation-decision"),
              ).toBeVisible();
              await waitForDeckAnimations(page);
              await toggle.click();
              await expect(toggle).toHaveAttribute("aria-pressed", "false");
              await expect(scene.locator("#stage-panel-0")).toBeVisible();
              await waitForDeckAnimations(page);
            } else if (scenes[index] === "build") {
              const buttons = scene.locator("[data-build]");
              expect(await buttons.count()).toBeGreaterThan(1);
              for (let build = 0; build < (await buttons.count()); build++) {
                await expect(buttons.nth(build)).toBeVisible();
                await buttons.nth(build).click();
                await expect(buttons.nth(build)).toHaveAttribute(
                  "aria-pressed",
                  "true",
                );
                await expect(
                  scene.locator(`#build-item-${build}`),
                ).toBeVisible();
                await expect(scene.locator(".build-item:visible")).toHaveCount(
                  1,
                );
                await waitForDeckAnimations(page);
              }
            } else if (
              scenes[index] === "results" ||
              scenes[index] === "scope"
            ) {
              const toggle = scene.locator(".detail-toggle");
              const detail = scene.locator(
                scenes[index] === "results"
                  ? ".results-context"
                  : ".presentation-scope",
              );
              await expect(toggle).toBeVisible();
              await toggle.click();
              await expect(toggle).toHaveAttribute("aria-pressed", "true");
              await expect(detail).toBeVisible();
              await waitForDeckAnimations(page);
              await toggle.click();
              await expect(toggle).toHaveAttribute("aria-pressed", "false");
              await expect(detail).toBeHidden();
              await waitForDeckAnimations(page);
            }
          }
          for (let index = scenes.length - 2; index >= 0; index--) {
            await page.keyboard.press("ArrowLeft");
            await expect(page.locator(`#${scenes[index]}`)).toBeVisible();
            await expect(page.locator(".scene:visible")).toHaveCount(1);
            await expect(sceneButtons.nth(index)).toHaveAttribute(
              "aria-current",
              "step",
            );
            await waitForDeckAnimations(page);
          }
          await expect(page).toHaveURL(
            new RegExp(`/${project.slug}\\.html#overview$`),
          );
        },
      );
    });
  }

  for (const reducedMotion of ["no-preference", "reduce"]) {
    test(`mobile ${reducedMotion}: menu close, project exit, and re-entry stay dark`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion });
      const records = await installProbe(page);
      await page.goto("/projects.html");
      const project = projects[1];
      await recordJourney(
        page,
        records,
        "mobile-open",
        () => card(page, project).click(),
        projectUrl(project),
        ".presentation-deck",
      );
      const menu = page.getByRole("button", { name: "Menu", exact: true });
      await menu.click();
      await page.keyboard.press("Escape");
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(page).toHaveURL(projectUrl(project));
      await recordJourney(
        page,
        records,
        "mobile-return",
        () => page.keyboard.press("Escape"),
        /\/projects\.html$/,
        ".project-card",
      );
      await recordJourney(
        page,
        records,
        "mobile-repeat",
        () => card(page, project).click(),
        projectUrl(project),
        ".presentation-deck",
      );
      await recordJourney(
        page,
        records,
        "mobile-selected-work",
        () =>
          page
            .getByRole("link", { name: "Selected work", exact: true })
            .click(),
        /\/index\.html#work$/,
        ".project-card",
      );
    });
  }

  test("the frame detector rejects a central white flash with dark gutters", async ({
    page,
  }) => {
    await page.goto("/projects.html");
    const data = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const context = canvas.getContext("2d");
      context.fillStyle = "#0c1c1a";
      context.fillRect(0, 0, 640, 360);
      context.fillStyle = "#fff";
      context.fillRect(160, 60, 320, 240);
      return canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
    });
    const [metric] = await analyseFrames(
      page,
      [
        {
          data: Buffer.from(data, "base64"),
          timestamp: Date.now(),
          viewportWidth: 640,
          viewportHeight: 360,
        },
      ],
      [],
    );
    expect(metric.whiteRatio).toBeGreaterThan(0.25);
  });
});
