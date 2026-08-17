import { chromium, expect, test, type Page } from "@playwright/test";

const projectSlugs = ["loop-engineering", "stocklane", "credit-risk-explorer"] as const;

async function expectLoadedImages(page: Page) {
  const images = page.locator(".homeProjectMedia img");
  await expect(images).toHaveCount(3);

  for (let index = 0; index < 3; index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element) => {
      const candidate = element as HTMLImageElement;
      return candidate.complete && candidate.naturalWidth > 0 && candidate.naturalHeight > 0;
    })).toBe(true);
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

test("homepage explains Himanshu's work in plain language", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page).toHaveTitle(/Himanshu Kumar/);
  await expect(page.getByText("Software Engineer · Agentic AI Engineer · Data Science", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", {
    level: 1,
    name: "Engineering intelligent systems people can use.",
  })).toBeVisible();
  await expect(page.getByText(/I design and build agentic AI tools, software products, and data-driven applications/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Loop Engineering" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stocklane" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Credit Risk Explorer" })).toBeVisible();
  await expect(page.getByText(/full[- ]stack/i)).toHaveCount(0);
  await expect(page.getByText(/Pulsewatch/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Download résumé/i }).first()).toHaveAttribute(
    "href",
    "/Himanshu-Kumar-Resume-2026.pdf",
  );
  expect(errors).toEqual([]);
});

test("reduced motion presents the connected glass form as a static fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const glassForm = page.locator('[data-glass-form="connected-knot"]');
  await expect(glassForm).toBeVisible();
  await expect(glassForm).toHaveAttribute("data-scene-mode", "fallback");
  await expect(glassForm.locator("canvas")).toHaveCount(0);
  const fallback = glassForm.locator("[data-hero-fallback]");
  await expect(fallback).toBeVisible();
});

test("homepage uses real project images and removes obsolete showcase UI", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expectLoadedImages(page);
  await expect(page.locator(".systemsInterlude")).toHaveCount(0);
  await expect(page.locator(".finaleExperience, [data-finale-mode]")).toHaveCount(0);
  await expect(page.locator(".homeProject .creditMock, .homeProject .creditShelfVisual")).toHaveCount(0);
  await expect(page.locator("[data-site-pointer-trail]")).toHaveCount(0);
});

test("mobile homepage loads all project images without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByAltText("Portrait of Himanshu Kumar").first()).toBeVisible();
  await expectLoadedImages(page);
  await expectNoHorizontalOverflow(page);
});

test("interactive glass knot redraws on contact and settles when the pointer leaves", async ({ page }) => {
  await page.addInitScript(() => {
    const state = globalThis as typeof globalThis & { __heroDrawCalls?: number };
    state.__heroDrawCalls = 0;
    const prototype = typeof WebGL2RenderingContext === "undefined"
      ? WebGLRenderingContext.prototype
      : WebGL2RenderingContext.prototype;
    const drawArrays = prototype.drawArrays;
    const drawElements = prototype.drawElements;
    prototype.drawArrays = function (...args: Parameters<WebGLRenderingContext["drawArrays"]>) {
      state.__heroDrawCalls = (state.__heroDrawCalls ?? 0) + 1;
      return drawArrays.apply(this, args);
    };
    prototype.drawElements = function (...args: Parameters<WebGLRenderingContext["drawElements"]>) {
      state.__heroDrawCalls = (state.__heroDrawCalls ?? 0) + 1;
      return drawElements.apply(this, args);
    };
  });
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const scene = page.locator('[data-glass-form="connected-knot"]');
  const canvas = scene.locator("canvas");
  await expect(scene).toHaveAttribute("data-scene-mode", "webgl");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1_500);

  const drawCalls = () => page.evaluate(() => (
    globalThis as typeof globalThis & { __heroDrawCalls?: number }
  ).__heroDrawCalls ?? 0);
  const idleFingerprintA = await canvas.screenshot();
  await page.waitForTimeout(500);
  const idleFingerprintB = await canvas.screenshot();
  expect(idleFingerprintB.equals(idleFingerprintA)).toBe(true);

  const idleDraws = await drawCalls();
  await page.mouse.move(24, 24);
  await page.waitForTimeout(250);
  expect((await drawCalls()) - idleDraws).toBeLessThanOrEqual(4);
  const outsideFingerprint = await canvas.screenshot();
  expect(outsideFingerprint.equals(idleFingerprintB)).toBe(true);

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const glassPoint = { x: box!.x + box!.width * 0.72, y: box!.y + box!.height * 0.46 };
  await page.mouse.move(glassPoint.x - box!.width * 0.15, glassPoint.y, { steps: 4 });
  const beforeGlassMove = await drawCalls();
  await page.mouse.move(glassPoint.x, glassPoint.y, { steps: 8 });
  await expect.poll(drawCalls).toBeGreaterThan(beforeGlassMove);

  await page.mouse.move(24, 24);
  await page.waitForTimeout(1_000);
  const pointerOutFingerprintA = await canvas.screenshot();
  await page.waitForTimeout(500);
  const pointerOutFingerprintB = await canvas.screenshot();
  expect(pointerOutFingerprintB.equals(pointerOutFingerprintA)).toBe(true);
});

test("interactive glass pauses after leaving the viewport", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const scene = page.locator('[data-glass-form="connected-knot"]');
  await expect(scene).toHaveAttribute("data-scene-active", "true");
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-scene-active", "false");
});

test("hero falls back cleanly when WebGL is unavailable", async () => {
  const browser = await chromium.launch({ headless: true, args: ["--disable-webgl", "--disable-gpu"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1_280, height: 800 } });
    const baseURL = test.info().project.use.baseURL;
    if (!baseURL) throw new Error("Playwright baseURL is required for the disabled-WebGL check.");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(baseURL);
    const scene = page.locator('[data-glass-form="connected-knot"]');
    await expect(scene).toHaveAttribute("data-scene-mode", "fallback");
    await expect(scene.locator("[data-hero-fallback]")).toBeVisible();
    await expect(scene.locator("canvas")).toHaveCount(0);
  } finally {
    await browser.close();
  }
});

test("keyboard navigation exposes the skip link and mobile menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);

  const menu = page.locator("details.mobileNav");
  await menu.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("open", "");
  const linksAreLargeEnough = await page.locator(".heroActions a, .homeProjectLinks a").evaluateAll((links) =>
    links.every((link) => link.getBoundingClientRect().height >= 44),
  );
  expect(linksAreLargeEnough).toBe(true);
});

for (const slug of projectSlugs) {
  test(`case study ${slug} exposes decisions and verification`, async ({ page }) => {
    await page.goto(`/work/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What I chose—and why." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What the evidence establishes." })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Next case study" })).toBeVisible();
  });
}

test("stocklane case study reflows at mobile and zoom-equivalent widths", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/work/stocklane");
    await expect(page.getByRole("heading", { level: 1, name: "Stocklane" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("publishing metadata exposes canonical, social, robots, and sitemap surfaces", async ({ page, request }) => {
  await page.goto("/work/stocklane");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/work\/stocklane$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", "Stocklane");

  const socialImage = await request.get("/opengraph-image");
  expect(socialImage.ok()).toBe(true);
  expect(socialImage.headers()["content-type"]).toContain("image/png");
  expect((await socialImage.body()).byteLength).toBeGreaterThan(10_000);
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Sitemap:");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain("/work/stocklane");
  expect(sitemapText).not.toContain("/work/pulsewatch");
  expect((await request.get("/work/pulsewatch")).status()).toBe(404);
});
