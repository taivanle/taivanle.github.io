import { test, expect } from "@playwright/test";

const homeUrl = /\/index\.html#work$/;
const projects = [
  ["themis", "Themis"],
  ["dueform", "DueForm"],
  ["actifact", "ActiFact"],
];

async function installHeadingProbe(page) {
  const records = [];
  await page.exposeBinding("__reportChapterReturn", (_source, record) => {
    records.push(record);
  });
  await page.addInitScript(() => {
    const documentId = `${Date.now()}:${Math.random()}`;
    window.__chapterReturnDocumentId = documentId;
    const animationIds = new WeakMap();
    let nextAnimationId = 0;
    let running = false;
    let frame;
    function report(record) {
      window
        .__reportChapterReturn({
          time: Date.now(),
          href: location.href,
          documentId,
          ...record,
        })
        .catch(() => {});
    }
    function sample() {
      if (!running) return;
      const heading = document.getElementById("work-title");
      if (heading) {
        const style = getComputedStyle(heading);
        const rect = heading.getBoundingClientRect();
        let opacity = 1;
        let visible = rect.width > 0 && rect.height > 0;
        for (let element = heading; element; element = element.parentElement) {
          const parentStyle = getComputedStyle(element);
          opacity *= Number(parentStyle.opacity);
          if (
            parentStyle.display === "none" ||
            parentStyle.visibility !== "visible" ||
            parentStyle.contentVisibility === "hidden"
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
        const left = Math.max(0, rect.left + clip[3]);
        const right = Math.min(innerWidth, rect.right - clip[1]);
        const top = Math.max(0, rect.top + clip[0]);
        const bottom = Math.min(innerHeight, rect.bottom - clip[2]);
        const visibleFraction =
          visible && rect.width * rect.height > 0
            ? (Math.max(0, right - left) * Math.max(0, bottom - top)) /
              (rect.width * rect.height)
            : 0;
        const animations = heading
          .getAnimations({ subtree: true })
          .map((animation) => {
            if (!animationIds.has(animation))
              animationIds.set(animation, ++nextAnimationId);
            return {
              id: `${documentId}:${animationIds.get(animation)}`,
              name: animation.animationName || "web-animation",
              currentTime: animation.currentTime,
              startTime: animation.startTime,
              state: animation.playState,
            };
          });
        report({
          kind: "sample",
          opacity,
          clipPath: style.clipPath,
          supportedClip,
          visibleFraction,
          display: style.display,
          visibility: style.visibility,
          transform: style.transform,
          top: rect.top,
          scrollY,
          phase: document.documentElement.dataset.pageTransition || null,
          sectionClass: heading.closest(".chapter-section")?.className,
          animations,
        });
      }
      frame = requestAnimationFrame(sample);
    }
    function start() {
      if (running) return;
      running = true;
      sample();
    }
    for (const kind of ["animationstart", "animationcancel", "animationend"])
      document.addEventListener(
        kind,
        (event) => {
          if (event.target.closest?.("#work-title"))
            report({
              kind,
              name: event.animationName,
              elapsedTime: event.elapsedTime,
            });
        },
        true,
      );
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
    start();
  });
  return records;
}

async function assertStableReturn(
  page,
  records,
  firstRecord,
  departedDocumentId,
  label,
) {
  await expect(page).toHaveURL(homeUrl);
  await expect(page.locator("#work-title")).toHaveText("Selected projects.");
  await expect
    .poll(() =>
      records
        .slice(firstRecord)
        .some(
          (record) =>
            record.kind === "transition" &&
            record.phase === "settled" &&
            homeUrl.test(record.href),
        ),
    )
    .toBe(true);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-page-transition",
    /^(leaving|entering)$/,
  );
  const returned = () =>
    records.slice(firstRecord).filter((record) => homeUrl.test(record.href));
  const settled = returned().find(
    (record) => record.kind === "transition" && record.phase === "settled",
  );
  // No further scrolling or interaction occurs during this observation window.
  await expect
    .poll(
      () => {
        const last = returned()
          .filter((record) => record.kind === "sample")
          .at(-1);
        return last ? last.time - settled.time : 0;
      },
      { timeout: 5000 },
    )
    .toBeGreaterThanOrEqual(2000);
  const timeline = returned();
  const samples = timeline.filter(
    (record) =>
      record.kind === "sample" &&
      record.time >= settled.time &&
      record.time <= settled.time + 2100,
  );
  const restored = samples[0]?.documentId === departedDocumentId;
  // A cold reload may reveal its new heading once. A restored heading was
  // already revealed before departure and must not replay at all.
  const allowance = restored ? 0 : 1;
  const starts = timeline.filter((record) => record.kind === "animationstart");
  const baselineIds = new Set(
    records
      .slice(0, firstRecord)
      .filter(
        (record) =>
          record.kind === "sample" && record.documentId === departedDocumentId,
      )
      .flatMap((record) => record.animations.map((animation) => animation.id)),
  );
  const newIds = new Set(
    timeline
      .filter((record) => record.kind === "sample")
      .flatMap((record) => record.animations.map((animation) => animation.id))
      .filter((id) => !baselineIds.has(id)),
  );
  let rewinds = 0;
  const previousTimes = new Map();
  for (const sample of timeline.filter((record) => record.kind === "sample")) {
    for (const animation of sample.animations) {
      if (typeof animation.currentTime !== "number") continue;
      const previous = previousTimes.get(animation.id);
      if (previous !== undefined && animation.currentTime < previous - 32)
        rewinds++;
      previousTimes.set(animation.id, animation.currentTime);
    }
  }
  const invisible = samples.find(
    (sample) =>
      !sample.supportedClip ||
      sample.opacity < (restored ? 0.98 : 0.01) ||
      sample.visibleFraction < (restored ? 0.98 : 0.01),
  );
  const scrollRange = samples.length
    ? Math.max(...samples.map((sample) => sample.scrollY)) -
      Math.min(...samples.map((sample) => sample.scrollY))
    : Infinity;
  const last = samples.at(-1);
  const failed =
    samples.length < 20 ||
    starts.length > allowance ||
    newIds.size > allowance ||
    rewinds > 0 ||
    invisible ||
    scrollRange > 2 ||
    !last ||
    last.visibleFraction < 0.98 ||
    last.opacity < 0.98;
  if (failed) {
    await test.info().attach(`${label}-heading-timeline.json`, {
      body: Buffer.from(
        JSON.stringify(
          {
            restored,
            starts,
            newIds: [...newIds],
            rewinds,
            scrollRange,
            timeline,
          },
          null,
          2,
        ),
      ),
      contentType: "application/json",
    });
    await test
      .info()
      .attach(`${label}-heading.png`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
  }
  expect(
    samples.length,
    "sample the restored heading throughout two seconds",
  ).toBeGreaterThanOrEqual(20);
  expect(
    starts.length,
    "the heading must not repeatedly start its CSS reveal",
  ).toBeLessThanOrEqual(allowance);
  expect(
    newIds.size,
    "no replacement heading animation may replay after restoration",
  ).toBeLessThanOrEqual(allowance);
  expect(rewinds, "no heading animation may rewind or restart").toBe(0);
  expect(
    invisible,
    "the restored heading must stay opaque, unclipped, and in view",
  ).toBeUndefined();
  expect(
    scrollRange,
    "scroll position must remain stable after return settles",
  ).toBeLessThanOrEqual(2);
  expect(
    last.visibleFraction,
    "the heading ends fully visible",
  ).toBeGreaterThanOrEqual(0.98);
  expect(last.opacity, "the heading ends fully opaque").toBeGreaterThanOrEqual(
    0.98,
  );
}

test.describe("landing chapter return", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  for (const [slug, name] of projects) {
    test(`${name}: repeated Escape returns keep Selected projects steady`, async ({
      page,
    }) => {
      const records = await installHeadingProbe(page);
      await page.goto("/index.html#work");
      await page.evaluate(() => document.fonts.ready);
      await expect
        .poll(
          () =>
            records.filter((record) => record.kind === "sample").at(-1)
              ?.visibleFraction,
          { timeout: 8000 },
        )
        .toBeGreaterThanOrEqual(0.98);
      await expect
        .poll(() =>
          page
            .locator("#work-title")
            .evaluate(
              (heading) =>
                heading
                  .getAnimations({ subtree: true })
                  .filter(
                    (animation) =>
                      animation.playState === "running" || animation.pending,
                  ).length,
            ),
        )
        .toBe(0);
      for (let repeat = 1; repeat <= 2; repeat++) {
        const departedDocumentId = await page.evaluate(
          () => window.__chapterReturnDocumentId,
        );
        const link = page.getByRole("link", {
          name: `Read case study: ${name}`,
          exact: true,
        });
        // Click the visible top of the card so automation does not scroll the
        // heading away merely to centre the entire tall project link.
        await link.click({ position: { x: 40, y: 24 } });
        await expect(page).toHaveURL(new RegExp(`/${slug}\\.html$`));
        await expect(page.locator("html")).not.toHaveAttribute(
          "data-page-transition",
          /^(leaving|entering)$/,
        );
        const firstRecord = records.length;
        await page.keyboard.press("Escape");
        await assertStableReturn(
          page,
          records,
          firstRecord,
          departedDocumentId,
          `${slug}-return-${repeat}`,
        );
      }
    });
  }
});
