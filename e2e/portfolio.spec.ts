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

async function expectDecodedImage(image: Locator) {
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element) => {
    const candidate = element as HTMLImageElement;
    return candidate.complete && candidate.naturalWidth > 0 && candidate.naturalHeight > 0;
  })).toBe(true);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

async function expectBoxInsideViewport(locator: Locator, viewport: { width: number; height: number }) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

function boxesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

async function movePointerToGlassWord(page: Page, stage: Locator) {
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("The sculpted glass stage has no layout box.");

  for (const yRatio of [0.42, 0.5, 0.58, 0.66]) {
    for (const xRatio of [0.35, 0.45, 0.55, 0.65, 0.75]) {
      await page.mouse.move(box.x + box.width * xRatio, box.y + box.height * yRatio);
      await page.waitForTimeout(90);
      if (await stage.getAttribute("data-pointer-contact") === "true") {
        return { x: box.x + box.width * xRatio, y: box.y + box.height * yRatio };
      }
    }
  }

  throw new Error("Could not find a direct pointer hit on the sculpted glass word.");
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
    name: "I build software with craft & proof.",
  })).toBeVisible();
  await expect(page.getByText(/agentic developer tools, dependable products, and applied-ML interfaces/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Loop Engineering" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stocklane" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Credit Risk Explorer" })).toBeVisible();
  await expect(page.getByText(/full[- ]stack/i)).toHaveCount(0);
  await expect(page.getByText(/Pulsewatch/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Résumé", exact: true }).first()).toHaveAttribute(
    "href",
    "/Himanshu-Kumar-Resume-2026.pdf",
  );
  expect(errors).toEqual([]);
});

test("reduced motion presents the sculpted hello word as a polished static fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const glassForm = page.locator('[data-v8-hero] [data-glass-stage]');
  await expect(glassForm).toBeVisible();
  await expect(glassForm).toHaveAttribute("data-glass-word", "hello");
  await expect(glassForm).toHaveAttribute("data-scene-mode", "fallback");
  await expect(glassForm).toHaveAttribute("data-render-state", "ready");
  await expect(glassForm).toHaveAttribute("data-active-ripples", "0");
  await expect(glassForm.locator("canvas")).toBeHidden();
  const fallback = glassForm.locator("[data-glass-fallback]");
  await expect(fallback).toBeVisible();
  await expect(fallback.locator("svg path")).not.toHaveCount(0);
});

test("homepage uses real project images and removes obsolete showcase UI", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expectLoadedImages(page);
  await expect(page.locator("[data-project-secondary]")).toHaveCount(0);
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

test("About uses the requested profile card settings on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const about = page.locator("#about");
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

test("v8 hero keeps its sculpted glass render ready and sharp while idle", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const glass = page.locator('[data-v8-hero] [data-glass-stage]');
  await expect(glass).toHaveAttribute("data-glass-word", "hello");
  await expect(glass).toHaveAttribute("data-scene-mode", "webgl");
  await expect(glass).toHaveAttribute("data-render-state", "ready");
  await expect(glass).toHaveAttribute("data-active-ripples", "0");
  const canvas = glass.locator("canvas");
  await expect(canvas).toBeVisible();

  const backingStore = await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement;
    return {
      cssHeight: target.clientHeight,
      cssWidth: target.clientWidth,
      pixelHeight: target.height,
      pixelWidth: target.width,
    };
  });
  expect(backingStore.pixelWidth).toBeGreaterThanOrEqual(backingStore.cssWidth);
  expect(backingStore.pixelHeight).toBeGreaterThanOrEqual(backingStore.cssHeight);
  await page.waitForTimeout(500);
  await expect(canvas).toBeVisible();
  await expect(glass).toHaveAttribute("data-render-state", "ready");
  await expect(glass).toHaveAttribute("data-active-ripples", "0");
});

test("desktop and mobile first viewports contain the v8 hero without collisions or overflow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const viewport of [
    { width: 1_440, height: 900 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const hero = page.locator("[data-v8-hero]");
    const meta = hero.locator('[class*="studioHeroMeta"]');
    const claim = hero.locator('[class*="studioHeroClaim"]');
    const scene = hero.locator("[data-glass-stage]");
    const heading = page.getByRole("heading", { level: 1 });

    await expect(hero).toBeVisible();
    await expect(scene).toBeVisible();
    await expect(heading).toBeVisible();
    await expectBoxInsideViewport(meta, viewport);
    await expectBoxInsideViewport(claim, viewport);
    await expectBoxInsideViewport(heading, viewport);

    const metaBox = await meta.boundingBox();
    const claimBox = await claim.boundingBox();
    expect(metaBox && claimBox).toBeTruthy();
    if (metaBox && claimBox) expect(boxesOverlap(metaBox, claimBox)).toBe(false);

    const nav = page.locator("header").first();
    if (await nav.count()) await expectBoxInsideViewport(nav, viewport);
    await expectNoHorizontalOverflow(page);
  }
});

test("direct movement over the sculpted word creates bounded ripples that settle", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const scene = page.locator('[data-v8-hero] [data-glass-stage]');
  await expect(scene).toHaveAttribute("data-scene-mode", "webgl");
  const hitPoint = await movePointerToGlassWord(page, scene);
  await expect(scene).toHaveAttribute("data-pointer-contact", "true");
  for (let index = 0; index < 6; index += 1) {
    await page.mouse.move(
      hitPoint.x + (index % 2 === 0 ? 4 : -4),
      hitPoint.y + (index % 3 === 0 ? 3 : -3),
    );
    await page.waitForTimeout(90);
  }
  await expect.poll(async () => Number(await scene.getAttribute("data-active-ripples"))).toBeGreaterThan(1);
  const boundedCount = Number(await scene.getAttribute("data-active-ripples"));
  expect(boundedCount).toBeLessThanOrEqual(4);

  await page.mouse.move(8, 8);
  await expect(scene).toHaveAttribute("data-pointer-contact", "false");
  await expect.poll(async () => Number(await scene.getAttribute("data-active-ripples")), {
    timeout: 3_000,
  }).toBe(0);
  await expect(scene).toHaveAttribute("data-render-state", "ready");
});

test("pointer movement outside the sculpted word does not create word ripples", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const scene = page.locator('[data-v8-hero] [data-glass-stage]');
  await expect(scene).toHaveAttribute("data-active-ripples", "0");
  await page.mouse.move(8, 8);
  await page.mouse.move(40, 40, { steps: 8 });
  await page.waitForTimeout(250);
  await expect(scene).toHaveAttribute("data-pointer-contact", "false");
  await expect(scene).toHaveAttribute("data-active-ripples", "0");
});

test("hero falls back cleanly when WebGL is unavailable", async () => {
  const browser = await chromium.launch({ headless: true, args: ["--disable-webgl", "--disable-gpu"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1_280, height: 800 } });
    const baseURL = test.info().project.use.baseURL;
    if (!baseURL) throw new Error("Playwright baseURL is required for the disabled-WebGL check.");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(baseURL);
    const scene = page.locator('[data-v8-hero] [data-glass-stage]');
    await expect(scene).toHaveAttribute("data-scene-mode", "fallback");
    await expect(scene.locator("[data-glass-fallback]")).toBeVisible();
  } finally {
    await browser.close();
  }
});

test("keyboard navigation exposes the skip link and primary navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);

  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(navigation).toBeVisible();
  const firstNavigationLink = navigation.getByRole("link").first();
  await firstNavigationLink.focus();
  await expect(firstNavigationLink).toBeFocused();
  const linksAreLargeEnough = await page.locator("[data-primary-action], [data-project-action]").evaluateAll((links) =>
    links.every((link) => link.getBoundingClientRect().height >= 44),
  );
  expect(linksAreLargeEnough).toBe(true);
});

test("project cards keep the real images simple and static", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const media = page.locator("[data-project-media]");
  await media.first().scrollIntoViewIfNeeded();
  await expect(media).toHaveCount(3);
  await expect(page.locator("[data-project-frame]")).toHaveCount(0);
  await expect(page.locator("[data-frame-corner]")).toHaveCount(0);
  await expect(page.locator("[data-project-frame-cue]")).toHaveCount(0);
  await expect(media.locator("canvas")).toHaveCount(0);
  await expect(page.locator("[data-halftone-reveal]")).toHaveCount(0);
  for (let index = 0; index < 3; index += 1) {
    await expectDecodedImage(page.locator("[data-project-primary]").nth(index));
  }
  await media.first().hover();
  await expect(media.first().locator("[data-project-primary]")).toHaveCSS("transform", "none");
});

test("homepage lists the seven unique certifications from both CVs", async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const certifications = page.locator("#certifications");
  await certifications.scrollIntoViewIfNeeded();
  await expect(certifications.getByRole("heading", { name: "Certifications" })).toBeVisible();
  await expect(certifications.locator("[data-certificate]")).toHaveCount(7);

  const expectedCertificates = [
    ["AI Agents and Agentic AI Architecture in Python", "https://coursera.org/share/c0c916d553fe7e6a7fcb97218fba584d"],
    ["Supervised Machine Learning: Regression and Classification", "https://coursera.org/share/431044c97afc4385f04a9fdd0218d64a"],
    ["Excel Skills for Business Specialization", "https://coursera.org/share/1009d3c01cdd68aef1addeee59c77509"],
    ["R Programming", "https://coursera.org/share/3e9cede70711b7fdbb69a8c01783267e"],
    ["Approximation Algorithms and Linear Programming", "https://coursera.org/share/a784802d0811982b65dcb1bf90edccbb"],
    ["Dynamic Programming, Greedy Algorithms", "https://coursera.org/share/d276b8738e8d9822625ae1b15a98f0f9"],
    ["Algorithms on Strings", "https://coursera.org/share/6547c68a44057688f3f313f827ca8432"],
  ] as const;

  for (const [title, href] of expectedCertificates) {
    await expect(certifications.getByRole("link", { name: `View certificate: ${title}`, exact: true }))
      .toHaveAttribute("href", href);
  }
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
