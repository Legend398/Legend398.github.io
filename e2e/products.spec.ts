import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  test(`Products filter and DVIndex card work at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("status", { name: "Loading portfolio" })).toHaveCount(0);

    const filters = page.getByRole("group", { name: "Filter selected work" });
    const products = filters.getByRole("button", { name: "Products", exact: true });
    const projects = filters.getByRole("button", { name: "Projects", exact: true });
    const all = filters.getByRole("button", { name: "All", exact: true });
    const product = page.locator("[data-product-card]");

    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(product).toHaveCount(1);
    await expect(page.locator("[data-project-card]")).toHaveCount(3);

    await products.click();
    await products.click();
    await expect(products).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-project-card]")).toHaveCount(0);
    await expect(product.getByRole("heading", { name: "DVIndex" })).toBeVisible();
    const image = product.getByRole("img");
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute("src", /dvindex-preview\.jpg/);
    await expect(image).toHaveAttribute("alt", /customer-churn question/);
    await expect.poll(() => image.evaluate((element) => {
      const img = element as HTMLImageElement;
      return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
    })).toBe(true);

    const links = product.getByRole("link", { name: /Visit DVIndex/ });
    await expect(links).toHaveCount(2);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("href", "https://dvindex.co.in");
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noreferrer");
    }
    await expect(product.getByRole("link", { name: /#5 on DataAgentBench · Oct 2026/ }))
      .toHaveAttribute("href", "https://github.com/ucbepic/DataAgentBench/blob/6ad9d689393ff13b51a6bdcc0b98d1d4d8209f36/README.md#-leaderboard");
    await expect(product).not.toContainText(/architecture|framework|Jev|GPT|source code/i);
    await expect(product.getByRole("link", { name: /^GitHub/ })).toHaveCount(0);

    await filters.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`products-${viewport.width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width + 1);

    await projects.focus();
    await page.keyboard.press("Enter");
    await expect(projects).toBeFocused();
    await expect(projects).toHaveAttribute("aria-pressed", "true");
    await expect(product).toHaveCount(0);
    await expect(page.locator("[data-project-card]")).toHaveCount(3);

    await all.click();
    await expect(product).toHaveCount(1);
    await expect(page.locator("[data-project-card]")).toHaveCount(3);
    await expect(page.getByRole("status")).toHaveText("Showing 4 items");
  });
}
