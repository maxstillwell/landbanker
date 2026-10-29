// Run against the production build: MARKETING_BASE_URL=http://localhost:3100 node tests/marketing.e2e.mjs
// No account, hosted services, map providers or private product data are used.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base = process.env.MARKETING_BASE_URL || "http://localhost:3100";
const output = "artifacts/marketing";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.MARKETING_BROWSER_PATH
    ? { executablePath: process.env.MARKETING_BROWSER_PATH }
    : {}),
});
const paths = [
  "/",
  "/features",
  "/layers",
  "/solutions",
  "/pricing",
  "/about",
  "/contact",
];
const report = {
  routes: [],
  interactions: [],
  consoleErrors: [],
  failedRequests: [],
  unexpectedProductRequests: [],
};
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin === new URL(base).origin &&
      /^\/(api|maplibre)\//.test(url.pathname)
    ) {
      report.unexpectedProductRequests.push(url.pathname);
    }
  });
  page.on("pageerror", (error) => report.consoleErrors.push(error.message));
  page.on("requestfailed", (request) =>
    report.failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText,
    }),
  );
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    for (const path of paths) {
      const response = await page.goto(`${base}${path}`);
      assert.equal(response.status(), 200, path);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("main")).toBeVisible();
      assert.equal(
        new URL(
          await page.locator('link[rel="canonical"]').getAttribute("href"),
        ).href,
        new URL(
          path,
          process.env.MARKETING_SITE_ORIGIN || "https://landbanker.vercel.app",
        ).href,
      );
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
        "content",
        "en_AU",
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        /\S{10}/,
      );
      assert.match(await page.title(), /LandOS/);
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(
        layout.scrollWidth <= width + 1 && layout.body <= width + 1,
        `${path} overflows at ${width}: ${JSON.stringify(layout)}`,
      );
      const signupLinks = page.locator('a[href="/signup"]');
      const loginLinks = page.locator('a[href="/login"]');
      assert.ok(
        (await signupLinks.count()) > 0 && (await loginLinks.count()) > 0,
      );
      const localLinks = await page
        .locator('main a[href^="/"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      for (const href of localLinks)
        assert.ok(
          [...paths, "/signup", "/login"].includes(href.split("#")[0]),
          `Unknown link: ${href}`,
        );
      const filename = `${path === "/" ? "home" : path.slice(1)}-${width}.png`;
      if (width !== 320) {
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: join(output, filename), fullPage: true });
      }
      report.routes.push({
        path,
        width,
        status: response.status(),
        overflow: false,
        screenshot: width !== 320 ? filename : null,
      });
    }
  }

  // Menu can be operated with a keyboard, closes with Escape and keeps focus.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  const menu = page.locator('button[aria-controls="marketing-navigation"]');
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
  await menu.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Layers", exact: true })
    .click();
  await expect(page).toHaveURL(`${base}/layers`);
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Layers", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  report.interactions.push(
    "Mobile navigation: keyboard, Escape, focus, link navigation and active state",
  );

  // Skip link lands on the page content.
  await page.goto(base);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  report.interactions.push("Keyboard skip link");

  await page.getByRole("button", { name: /02\s*Research/ }).click();
  await expect(
    page.getByRole("heading", { name: "Give your investigation a place." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /02\s*Research/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('img[src="/marketing/spatial-study.svg"]'),
  ).toBeVisible();
  report.interactions.push("Illustrative pillar selector and image load");

  await page.goto(`${base}/pricing`);
  const question = page.getByText("Are paid plans available?", { exact: true });
  await question.click();
  await expect(
    page.getByText(
      "Public pricing and commercial plans have not been announced. There is no paid checkout on this website.",
      { exact: true },
    ),
  ).toBeVisible();
  report.interactions.push("Pricing FAQ opens with correct disclosure");

  await page.goto(`${base}/contact`);
  await page.getByLabel("Your name", { exact: true }).fill("Website QA");
  await page
    .getByLabel("Your email", { exact: true })
    .fill("website-qa@example.invalid");
  await page
    .getByLabel("Tell us about your requirements")
    .fill("Synthetic browser verification only. No message is sent.");
  const downloadButton = page.getByRole("button", { name: /Download enquiry/ });
  if (await downloadButton.count()) {
    const downloadEvent = page.waitForEvent("download");
    await downloadButton.click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), "landos-enquiry.txt");
    await expect(page.getByRole("status")).toContainText(
      "It has not been sent",
    );
    report.interactions.push("Enquiry download with explicit no-send state");
  }

  // Traverse real public account links; no auth submission or account creation.
  await page.goto(base);
  await page
    .getByRole("link", { name: "Create your workspace", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(`${base}/signup`);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('div[lang="en-AU"]')).toHaveCount(0);
  await page.goto(base);
  await page
    .getByRole("link", { name: "Sign in", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(`${base}/login`);
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('div[lang="en-AU"]')).toHaveCount(0);
  report.interactions.push(
    "Real signup and login CTA navigation; forms render without marketing styles",
  );

  const sitemap = await (
    await context.request.get(`${base}/sitemap.xml`)
  ).text();
  for (const path of paths)
    assert.ok(
      sitemap.includes(
        `https://landbanker.vercel.app${path === "/" ? "/" : path}`,
      ),
    );
  assert.ok(!sitemap.includes("/app/map") && !sitemap.includes("/share/"));
  const robots = await (await context.request.get(`${base}/robots.txt`)).text();
  for (const path of ["/app", "/api/", "/auth/", "/share/"])
    assert.ok(robots.includes(`Disallow: ${path}`));
  const social = await context.request.get(`${base}/marketing/social-card.png`);
  assert.equal(social.status(), 200);
  assert.match(social.headers()["content-type"], /image\/png/);
  report.interactions.push(
    "Sitemap limited to seven marketing URLs, crawler exclusions, social image",
  );
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.unexpectedProductRequests, []);
  console.log(JSON.stringify(report, null, 2));
  await writeFile(
    join(output, "verification.json"),
    JSON.stringify(report, null, 2),
  );
} finally {
  await browser.close();
}
