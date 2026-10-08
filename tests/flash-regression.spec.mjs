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
    const destination = page.locator(selector);
    if (selector === ".project-card") {
      await expect(destination).toHaveCount(3);
      await expect(destination.first()).toBeVisible();
    } else await expect(destination).toBeVisible();
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

// This is explicit lifecycle simulation, not browser BFCache coverage. Keep the
// actual departing DOM and navigation closure alive, then deliver the persisted
// lifecycle events to their real listeners. Playwright disables browser BFCache.
async function installPersistedLifecycleProbe(page, selector) {
  return page.evaluate((selector) => {
    const heading = document.querySelector(selector);
    const state = {
      document,
      heading,
      id: `${Date.now()}:${Math.random()}`,
    };
    window.__persistedLifecycleState = state;
    const animationIds = new WeakMap();
    let nextAnimationId = 0;
    let running = false;
    let frame;
    function report(record) {
      window
        .__reportFlashProbe({
          time: Date.now(),
          href: location.href,
          documentId: state.id,
          ...record,
        })
        .catch(() => {});
    }
    function sample() {
      if (!running) return;
      const style = getComputedStyle(heading);
      const rect = heading.getBoundingClientRect();
      let opacity = 1;
      let visible = rect.width > 0 && rect.height > 0;
      for (let element = heading; element; element = element.parentElement) {
        const ancestor = getComputedStyle(element);
        opacity *= Number(ancestor.opacity);
        if (
          ancestor.display === "none" ||
          ancestor.visibility !== "visible" ||
          ancestor.contentVisibility === "hidden"
        )
          visible = false;
      }
      let clip = [0, 0, 0, 0];
      let supportedClip = style.clipPath === "none";
      const inset = /^inset\(([^)]*)\)$/.exec(style.clipPath);
      if (inset) {
        const values = inset[1]
          .split(/\s+round\s+/)[0]
          .trim()
          .split(/\s+/);
        const expanded =
          values.length === 1
            ? [values[0], values[0], values[0], values[0]]
            : values.length === 2
              ? [values[0], values[1], values[0], values[1]]
              : values.length === 3
                ? [values[0], values[1], values[2], values[1]]
                : values;
        if (expanded.length === 4) {
          supportedClip = true;
          clip = expanded.map(
            (value, index) =>
              parseFloat(value) *
              (value.endsWith("%")
                ? (index % 2 ? rect.width : rect.height) / 100
                : 1),
          );
        }
      }
      const width = Math.max(
        0,
        Math.min(innerWidth, rect.right - clip[1]) -
          Math.max(0, rect.left + clip[3]),
      );
      const height = Math.max(
        0,
        Math.min(innerHeight, rect.bottom - clip[2]) -
          Math.max(0, rect.top + clip[0]),
      );
      const animations = heading
        .getAnimations({ subtree: true })
        .map((animation) => {
          if (!animationIds.has(animation))
            animationIds.set(animation, ++nextAnimationId);
          return {
            id: animationIds.get(animation),
            currentTime: animation.currentTime,
            state: animation.playState,
          };
        });
      report({
        kind: "lifecycle-heading",
        opacity,
        clipPath: style.clipPath,
        supportedClip,
        visibleFraction: visible
          ? (width * height) / (rect.width * rect.height)
          : 0,
        scrollY,
        animations,
      });
      frame = requestAnimationFrame(sample);
    }
    function start() {
      if (running) return;
      running = true;
      sample();
    }
    document.addEventListener(
      "animationstart",
      (event) => {
        if (event.target === heading || heading.contains(event.target))
          report({
            kind: "lifecycle-heading-start",
            name: event.animationName,
          });
      },
      true,
    );
    window.addEventListener("pagehide", (event) => {
      report({
        kind: "lifecycle-hide",
        persisted: event.persisted,
        trusted: event.isTrusted,
      });
      running = false;
      cancelAnimationFrame(frame);
    });
    window.addEventListener("pageshow", (event) => {
      report({
        kind: "lifecycle-show",
        persisted: event.persisted,
        trusted: event.isTrusted,
      });
      start();
    });
    start();
    return state.id;
  }, selector);
}

async function assertPersistedHeading(page, records, firstRecord, documentId) {
  const timeline = () => records.slice(firstRecord);
  const settled = timeline().find(
    (record) => record.kind === "transition" && record.phase === "settled",
  );
  await expect
    .poll(
      () => {
        const samples = timeline().filter(
          (record) => record.kind === "lifecycle-heading",
        );
        return (
          samples.length >= 20 && samples.at(-1).time - settled.time >= 2000
        );
      },
      { timeout: 5000 },
    )
    .toBe(true);
  const headings = timeline().filter(
    (record) => record.kind === "lifecycle-heading",
  );
  const baselineIds = new Set(
    records
      .slice(0, firstRecord)
      .filter((record) => record.kind === "lifecycle-heading")
      .flatMap((record) => record.animations.map((animation) => animation.id)),
  );
  const newIds = new Set(
    headings
      .flatMap((record) => record.animations.map((animation) => animation.id))
      .filter((id) => !baselineIds.has(id)),
  );
  const previousTimes = new Map();
  let rewinds = 0;
  for (const record of headings)
    for (const animation of record.animations) {
      if (typeof animation.currentTime !== "number") continue;
      const previous = previousTimes.get(animation.id);
      if (previous !== undefined && animation.currentTime < previous - 32)
        rewinds++;
      previousTimes.set(animation.id, animation.currentTime);
    }
  const invisible = headings.find(
    (record) =>
      record.documentId !== documentId ||
      !record.supportedClip ||
      record.opacity < 0.98 ||
      record.visibleFraction < 0.98,
  );
  const starts = timeline().filter(
    (record) => record.kind === "lifecycle-heading-start",
  );
  const scrollRange =
    Math.max(...headings.map((record) => record.scrollY)) -
    Math.min(...headings.map((record) => record.scrollY));
  if (
    invisible ||
    starts.length ||
    newIds.size ||
    rewinds ||
    scrollRange > 2 ||
    headings.length < 20
  ) {
    await test.info().attach("persisted-lifecycle-heading.json", {
      body: Buffer.from(
        JSON.stringify(
          { timeline: timeline(), newIds: [...newIds], rewinds, scrollRange },
          null,
          2,
        ),
      ),
      contentType: "application/json",
    });
    await test.info().attach("persisted-lifecycle-heading.png", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  }
  expect(
    headings.length,
    "observe the same heading for two seconds",
  ).toBeGreaterThanOrEqual(20);
  expect(
    invisible,
    "the retained heading stays opaque, unclipped, and in view",
  ).toBeUndefined();
  expect(
    starts,
    "persisted pageshow must not replay its heading reveal",
  ).toHaveLength(0);
  expect(newIds.size, "no replacement heading animation").toBe(0);
  expect(rewinds, "no heading animation restart").toBe(0);
  expect(
    scrollRange,
    "no scroll jump after lifecycle restoration",
  ).toBeLessThanOrEqual(2);
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

    test(`${origin.name}: same-document persisted pageshow lifecycle and repeated entry stay dark`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const records = await installProbe(page);
      await page.goto(origin.path);
      await page.evaluate(() => document.fonts.ready);
      const project = projects[1];
      const headingSelector =
        origin.name === "landing Work" ? "#work-title" : ".page-hero h1";
      const heading = page.locator(headingSelector);
      await expect(heading).toBeVisible();
      const documentId = await installPersistedLifecycleProbe(
        page,
        headingSelector,
      );
      await expect
        .poll(
          () =>
            records
              .filter((record) => record.kind === "lifecycle-heading")
              .at(-1)?.visibleFraction,
          { timeout: 8000 },
        )
        .toBeGreaterThanOrEqual(0.98);
      await expect
        .poll(() =>
          heading.evaluate(
            (element) =>
              element
                .getAnimations({ subtree: true })
                .filter(
                  (animation) =>
                    animation.playState === "running" || animation.pending,
                ).length,
          ),
        )
        .toBe(0);
      // Abort only the first real document navigation so the real leave() state,
      // opaque cover and departing latch remain in this original document.
      let abortedRequests = 0;
      await page.route(
        projectUrl(project),
        async (route) => {
          expect(route.request().isNavigationRequest()).toBe(true);
          abortedRequests++;
          await route.abort("aborted");
        },
        { times: 1 },
      );
      const firstRecord = records.length;
      const restored = await recordJourney(
        page,
        records,
        "synthetic-persisted-restore",
        async () => {
          await card(page, project).click({
            position: { x: 40, y: 24 },
            noWaitAfter: true,
          });
          await expect.poll(() => abortedRequests).toBe(1);
          await expect(page).toHaveURL(origin.url);
          const frozen = await page.evaluate(() => {
            const state = window.__persistedLifecycleState;
            const cover = document.getElementById("navigation-cover");
            return {
              sameDocument: state?.document === document,
              sameHeading:
                state?.heading ===
                document.querySelector("#work-title, .page-hero h1"),
              phase: document.documentElement.dataset.pageTransition,
              coverReady: document.documentElement.dataset.coverReady,
              opacity: cover && getComputedStyle(cover).opacity,
              pointerEvents: cover && getComputedStyle(cover).pointerEvents,
              marker: JSON.parse(
                sessionStorage.getItem("portfolio-navigation-transition"),
              ),
            };
          });
          expect(frozen).toMatchObject({
            sameDocument: true,
            sameHeading: true,
            phase: "leaving",
            coverReady: "true",
            opacity: "1",
            pointerEvents: "auto",
          });
          expect(frozen.marker.from).toBe(page.url());
          expect(frozen.marker.to).toMatch(projectUrl(project));
          expect(frozen.marker.direction).toBe("open");
          // Explicitly simulated persisted events are untrusted. No browser
          // cache eligibility, freeze or restoration is claimed by this test.
          await page.evaluate(() =>
            window.dispatchEvent(
              new PageTransitionEvent("pagehide", { persisted: true }),
            ),
          );
          await page.waitForTimeout(80);
          await page.evaluate((outgoing) => {
            sessionStorage.setItem(
              "portfolio-navigation-transition",
              JSON.stringify({
                ...outgoing,
                from: outgoing.to,
                to: outgoing.from,
                direction: "close",
                at: Date.now(),
              }),
            );
            window.dispatchEvent(
              new PageTransitionEvent("pageshow", { persisted: true }),
            );
          }, frozen.marker);
        },
        origin.url,
        ".project-card",
      );
      expect(
        abortedRequests,
        "exactly one target document was prevented from replacing the source",
      ).toBe(1);
      expect(
        restored.filter((record) => record.kind === "lifecycle-hide"),
      ).toMatchObject([{ persisted: true, trusted: false, documentId }]);
      expect(
        restored.filter((record) => record.kind === "lifecycle-show"),
      ).toMatchObject([{ persisted: true, trusted: false, documentId }]);
      expect(
        restored.some(
          (record) =>
            record.kind === "transition" &&
            record.phase === "entering" &&
            record.direction === "close",
        ),
      ).toBe(true);
      const cleanup = await page.evaluate(() => {
        const state = window.__persistedLifecycleState;
        const cover = document.getElementById("navigation-cover");
        return {
          documentId: state?.id,
          sameDocument: state?.document === document,
          sameHeading:
            state?.heading ===
            document.querySelector("#work-title, .page-hero h1"),
          phase: document.documentElement.dataset.pageTransition || null,
          coverReady: document.documentElement.dataset.coverReady || null,
          marker: sessionStorage.getItem("portfolio-navigation-transition"),
          opacity: cover && getComputedStyle(cover).opacity,
          pointerEvents: cover && getComputedStyle(cover).pointerEvents,
        };
      });
      expect(cleanup).toEqual({
        documentId,
        sameDocument: true,
        sameHeading: true,
        phase: null,
        coverReady: null,
        marker: null,
        opacity: "0",
        pointerEvents: "none",
      });
      await assertPersistedHeading(page, records, firstRecord, documentId);
      // Normal navigation after the simulation must still work. A stale
      // departing latch or blocking cover would prevent this repeated entry.
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
