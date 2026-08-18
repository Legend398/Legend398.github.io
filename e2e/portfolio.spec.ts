import { chromium, expect, test, type Locator, type Page } from "@playwright/test";

const projectSlugs = ["loop-engineering", "stocklane", "credit-risk-explorer"] as const;

async function expectLoadedImages(page: Page) {
  const images = page.locator("[data-project-primary]");
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

async function webglFingerprint(canvas: Locator) {
  return canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement;
    const context = target.getContext("webgl2") ?? target.getContext("webgl");
    if (!context) return 0;
    const pixels = new Uint8Array(context.drawingBufferWidth * context.drawingBufferHeight * 4);
    context.readPixels(
      0,
      0,
      context.drawingBufferWidth,
      context.drawingBufferHeight,
      context.RGBA,
      context.UNSIGNED_BYTE,
      pixels,
    );
    let hash = 2_166_136_261;
    for (let index = 0; index < pixels.length; index += 17) {
      hash ^= pixels[index] ?? 0;
      hash = Math.imul(hash, 16_777_619);
    }
    return hash >>> 0;
  });
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
    name: "Software, AI, and data—built to be used.",
  })).toBeVisible();
  await expect(page.getByText(/I design agentic AI tools, reliable software products, and clear machine-learning applications/i)).toBeVisible();
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

test("reduced motion presents BUILD as a static readable glass fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const glassForm = page.locator('[data-glass-stage]');
  await expect(glassForm).toBeVisible();
  await expect(glassForm).toHaveAttribute("data-glass-word", "BUILD");
  await expect(glassForm).toHaveAttribute("data-scene-mode", "fallback");
  await expect(glassForm.locator("canvas")).toHaveCount(0);
  const fallback = glassForm.locator("[data-glass-fallback]");
  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText("BUILD");
});

test("homepage uses real project images and removes obsolete showcase UI", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expectLoadedImages(page);
  await expect(page.locator("[data-project-secondary]")).toHaveCount(3);
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
  await expect(page.locator("[data-profile-card]")).toBeVisible();
  await expectLoadedImages(page);
  await expectNoHorizontalOverflow(page);
});

test("About uses the requested profile card settings and mobile uses a static ether fallback", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const about = page.locator("#about");
  const ether = page.locator('[data-glass-zone="hero"] [data-mode]');
  await about.scrollIntoViewIfNeeded();
  const profileCard = about.locator("[data-profile-card]");

  await expect(profileCard).toBeVisible();
  await expect(profileCard.locator("[data-profile-behind-glow]")).toHaveCount(1);
  await expect(profileCard.locator("[data-profile-user-info]")).toHaveCount(1);
  await expect(profileCard.locator("[data-profile-icon-pattern]")).toHaveCount(0);
  await expect(profileCard.getByRole("link", { name: /Email, contact Himanshu Kumar/i })).toHaveAttribute(
    "href",
    "mailto:hk270941@gmail.com",
  );
  await expect(ether).toHaveAttribute("data-mode", "css");
  await expect(ether.locator("canvas")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("profile ripple mounts only while the About card is visible", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const ripple = page.locator("[data-ripple-distortion]");
  await expect(ripple).toHaveCount(0);
  await page.locator("#about").scrollIntoViewIfNeeded();
  await expect(ripple).toHaveCount(1);
  await expect(ripple.locator("canvas")).toHaveCount(1);
  await page.locator("#work").scrollIntoViewIfNeeded();
  await expect(ripple).toHaveCount(0);
});

test("the official hero ether is scoped to BUILD and sleeps when the hero leaves view", async ({ page }) => {
  await page.addInitScript(() => {
    const state = globalThis as typeof globalThis & { __etherDrawCalls?: number };
    state.__etherDrawCalls = 0;
    const countEtherDraw = (context: WebGLRenderingContext | WebGL2RenderingContext) => {
      const canvas = context.canvas;
      if (canvas instanceof HTMLCanvasElement && canvas.closest("[data-liquid-ether]")) {
        state.__etherDrawCalls = (state.__etherDrawCalls ?? 0) + 1;
      }
    };
    const prototype = typeof WebGL2RenderingContext === "undefined"
      ? WebGLRenderingContext.prototype
      : WebGL2RenderingContext.prototype;
    const drawArrays = prototype.drawArrays;
    const drawElements = prototype.drawElements;
    prototype.drawArrays = function (...args: Parameters<WebGLRenderingContext["drawArrays"]>) {
      countEtherDraw(this);
      return drawArrays.apply(this, args);
    };
    prototype.drawElements = function (...args: Parameters<WebGLRenderingContext["drawElements"]>) {
      countEtherDraw(this);
      return drawElements.apply(this, args);
    };
  });
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const glass = page.locator("[data-glass-stage]");
  const hero = page.locator('[data-glass-zone="hero"]');
  const about = page.locator("#about");
  const ether = hero.locator("[data-mode]");

  await expect(glass).toHaveAttribute("data-scene-active", "true");
  await expect(ether).toHaveAttribute("data-mode", "webgl");
  await expect(ether.locator("canvas")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (
    globalThis as typeof globalThis & { __etherDrawCalls?: number }
  ).__etherDrawCalls ?? 0)).toBeGreaterThan(0);

  await about.scrollIntoViewIfNeeded();
  await expect(glass).toHaveAttribute("data-scene-active", "false");
  await expect(about.locator("[data-mode]")).toHaveCount(0);
  await page.waitForTimeout(200);
  const offscreenDraws = await page.evaluate(() => (
    globalThis as typeof globalThis & { __etherDrawCalls?: number }
  ).__etherDrawCalls ?? 0);
  await page.waitForTimeout(600);
  const settledDraws = await page.evaluate(() => (
    globalThis as typeof globalThis & { __etherDrawCalls?: number }
  ).__etherDrawCalls ?? 0);
  expect(settledDraws - offscreenDraws).toBeLessThanOrEqual(2);

  await page.locator("#work").scrollIntoViewIfNeeded();
  await expect(glass).toHaveAttribute("data-scene-active", "false");
});

test("mobile hero is an authored scene instead of stacked desktop blocks", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const hero = page.locator('[data-glass-zone="hero"]');
    const role = page.locator("[data-hero-role]");
    const title = page.locator("[data-hero-title-block]");
    const glassSlot = page.locator("[data-mobile-glass-slot]");
    const fallbackWord = page.locator("[data-glass-fallback] span");
    const bottom = page.locator("[data-hero-bottom]");
    const about = page.locator("#about");

    await expect(glassSlot).toBeVisible();
    const boxes = await Promise.all([
      hero.boundingBox(),
      role.boundingBox(),
      title.boundingBox(),
      glassSlot.boundingBox(),
      fallbackWord.boundingBox(),
      bottom.boundingBox(),
      about.boundingBox(),
    ]);
    const [heroBox, roleBox, titleBox, slotBox, wordBox, bottomBox, aboutBox] = boxes;
    expect(heroBox && roleBox && titleBox && slotBox && wordBox && bottomBox && aboutBox).toBeTruthy();
    if (!heroBox || !roleBox || !titleBox || !slotBox || !wordBox || !bottomBox || !aboutBox) continue;

    expect(roleBox.y).toBeGreaterThanOrEqual(72);
    expect(titleBox.y).toBeGreaterThan(roleBox.y + roleBox.height);
    expect(slotBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
    expect(slotBox.height).toBeGreaterThanOrEqual(150);
    expect(bottomBox.y).toBeGreaterThan(slotBox.y + slotBox.height);
    expect(wordBox.y).toBeGreaterThanOrEqual(slotBox.y - 24);
    expect(wordBox.y + wordBox.height).toBeLessThanOrEqual(slotBox.y + slotBox.height + 24);
    expect(aboutBox.y).toBeLessThanOrEqual(viewport.height - 16);
    expect(heroBox.height).toBeGreaterThanOrEqual(680);
    await expectNoHorizontalOverflow(page);
  }
});

test("interactive glass word changes only on direct contact and settles after pointer exit", async ({ page }) => {
  await page.addInitScript(() => {
    const state = globalThis as typeof globalThis & { __heroDrawCalls?: number };
    state.__heroDrawCalls = 0;
    const countHeroDraw = (context: WebGLRenderingContext | WebGL2RenderingContext) => {
      const canvas = context.canvas;
      if (canvas instanceof HTMLCanvasElement && canvas.closest("[data-glass-stage]")) {
        state.__heroDrawCalls = (state.__heroDrawCalls ?? 0) + 1;
      }
    };
    const prototype = typeof WebGL2RenderingContext === "undefined"
      ? WebGLRenderingContext.prototype
      : WebGL2RenderingContext.prototype;
    const drawArrays = prototype.drawArrays;
    const drawElements = prototype.drawElements;
    prototype.drawArrays = function (...args: Parameters<WebGLRenderingContext["drawArrays"]>) {
      countHeroDraw(this);
      return drawArrays.apply(this, args);
    };
    prototype.drawElements = function (...args: Parameters<WebGLRenderingContext["drawElements"]>) {
      countHeroDraw(this);
      return drawElements.apply(this, args);
    };
  });
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const scene = page.locator('[data-glass-stage]');
  const canvas = scene.locator("canvas");
  await expect(scene).toHaveAttribute("data-scene-mode", "webgl");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1_500);

  const drawCalls = () => page.evaluate(() => (
    globalThis as typeof globalThis & { __heroDrawCalls?: number }
  ).__heroDrawCalls ?? 0);
  const idleFingerprintA = await webglFingerprint(canvas);
  await page.waitForTimeout(500);
  const idleFingerprintB = await webglFingerprint(canvas);
  expect(idleFingerprintB).toBe(idleFingerprintA);

  const idleDraws = await drawCalls();
  await page.mouse.move(24, 24);
  await page.waitForTimeout(250);
  expect((await drawCalls()) - idleDraws).toBeLessThanOrEqual(4);
  const outsideFingerprint = await webglFingerprint(canvas);
  expect(outsideFingerprint).toBe(idleFingerprintB);
  const outsideDraws = await drawCalls();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const glassPoint = { x: box!.x + box!.width * 0.63, y: box!.y + box!.height * 0.4 };
  await page.mouse.move(glassPoint.x, glassPoint.y, { steps: 8 });
  await expect(scene).toHaveAttribute("data-pointer-contact", "true");
  await page.waitForTimeout(180);
  expect((await drawCalls()) - outsideDraws).toBeGreaterThan(4);

  await page.mouse.move(24, 24);
  await page.waitForTimeout(1_000);
  const pointerOutFingerprintA = await webglFingerprint(canvas);
  await page.waitForTimeout(500);
  const pointerOutFingerprintB = await webglFingerprint(canvas);
  expect(pointerOutFingerprintB).toBe(pointerOutFingerprintA);
});

test("shared glass stage sleeps between hero and contact and returns for the finale", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const scene = page.locator('[data-glass-stage]');
  await expect(scene).toHaveAttribute("data-scene-active", "true");
  await page.locator("#work").scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-scene-active", "false");
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-scene-active", "true");
  await expect(scene).toHaveAttribute("data-scene-zone", "contact");
});

test("hero falls back cleanly when WebGL is unavailable", async () => {
  const browser = await chromium.launch({ headless: true, args: ["--disable-webgl", "--disable-gpu"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1_280, height: 800 } });
    const baseURL = test.info().project.use.baseURL;
    if (!baseURL) throw new Error("Playwright baseURL is required for the disabled-WebGL check.");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(baseURL);
    const scene = page.locator('[data-glass-stage]');
    await expect(scene).toHaveAttribute("data-scene-mode", "fallback");
    await expect(scene.locator("[data-glass-fallback]")).toBeVisible();
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

  const menu = page.locator("[data-mobile-nav]");
  await menu.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("open", "");
  const linksAreLargeEnough = await page.locator("[data-primary-action], [data-project-action]").evaluateAll((links) =>
    links.every((link) => link.getBoundingClientRect().height >= 44),
  );
  expect(linksAreLargeEnough).toBe(true);
});

test("project hover changes only media paint, never project layout", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const project = page.locator("[data-project-card]").first();
  await project.scrollIntoViewIfNeeded();
  const title = project.getByRole("heading");
  const before = await title.boundingBox();
  await project.locator("[data-project-media]").hover({ position: { x: 420, y: 220 } });
  await page.waitForTimeout(300);
  const after = await title.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(2);
  await expect(project.locator("[data-project-media]")).toHaveAttribute("data-pointer-inside", "true");
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
