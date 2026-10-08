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
  await page.goto("/projects.html");
  let release;
  let intercept;
  const held = new Promise((resolve) => (release = resolve));
  const intercepted = new Promise((resolve) => (intercept = resolve));
  await page.route("**/assets/app.js*", async (route) => {
    if (route.request().headers().referer?.includes("/themis.html")) {
      intercept();
      await held;
    }
    await route.continue().catch(() => {});
  });
  try {
    await page
      .getByRole("link", { name: "Read case study: Themis", exact: true })
      .click({ noWaitAfter: true });
    await page.waitForURL(/themis.html$/, { waitUntil: "commit" });
    await intercepted;
    await page.keyboard.press("Escape");
    await expect(page.locator("html")).toHaveAttribute(
      "data-page-transition",
      "leaving",
    );
    release();
    await expect(page).toHaveURL(/projects.html$/);
    await expect(
      page.getByRole("link", { name: "Read case study: Themis", exact: true }),
    ).toBeVisible();
  } finally {
    release();
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
