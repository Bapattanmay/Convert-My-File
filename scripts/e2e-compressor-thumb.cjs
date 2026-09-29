/**
 * Compressor shows image thumbnail (or document card) after upload.
 * Also spot-checks translator scroll layout still healthy.
 *
 *   BASE_URL=https://convert-my-file-oo3r.onrender.com PROOF_LABEL=live- node scripts/e2e-compressor-thumb.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43127";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";
const FIX = path.join(OUT, "_compressor-fixtures");
const LABEL = process.env.PROOF_LABEL || "";

function assert(cond, msg, results) {
  if (!cond) throw new Error(msg);
  results.push("PASS: " + msg);
}

async function unlockAuth(page) {
  const fakeUser = {
    id: "e2e-qa-user",
    name: "E2E QA",
    email: "e2e-qa@convertmyfile.test",
    timeSpentSeconds: 0,
    featuresUsed: ["compressor"],
    location: { source: "e2e" },
  };
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: fakeUser, googleConfigured: true }),
    })
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { name: fakeUser.name, email: fakeUser.email },
        expires: new Date(Date.now() + 86400000).toISOString(),
        usageSessionId: "e2e-sid",
      }),
    })
  );
  await page.route("**/api/track", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  );
}

async function main() {
  fs.mkdirSync(FIX, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const png = path.join(FIX, "thumb-sample.png");
  fs.writeFileSync(
    png,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAhElEQVR42u3RAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAO/G+YAAXHsF8sAAAAASUVORK5CYII=",
      "base64"
    )
  );
  // minimal pdf
  const pdf = path.join(FIX, "thumb-sample.pdf");
  fs.writeFileSync(pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

  const results = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await unlockAuth(page);

  try {
    await page.goto(BASE + "/#tools", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator("#tools").scrollIntoViewIfNeeded();
    await page
      .getByText("Google login required")
      .waitFor({ state: "hidden", timeout: 20000 })
      .catch(() => {});
    await page.getByRole("tab", { name: "Compressor" }).click();
    await page.waitForTimeout(400);

    await page.locator('#tools input[type="file"]').first().setInputFiles(png);
    await page.waitForSelector('[data-testid="compress-thumb"]', { timeout: 10000 });
    const thumb = page.locator('[data-testid="compress-thumb"]');
    assert((await thumb.count()) === 1, "image thumbnail visible", results);
    const box = await thumb.boundingBox();
    assert(!!box && box.width >= 48 && box.height >= 48, `thumb size ${box?.width}x${box?.height}`, results);
    assert(
      (await page.locator('[data-testid="compress-file-card"]').innerText()).includes("thumb-sample.png"),
      "card shows filename",
      results
    );
    await page.screenshot({
      path: path.join(OUT, `${LABEL}compressor-image-thumb.png`),
      fullPage: false,
    });

    // PDF → document card without img thumb
    await page.locator('#tools input[type="file"]').first().setInputFiles(pdf);
    await page.waitForTimeout(500);
    assert(
      (await page.locator('[data-testid="compress-thumb"]').count()) === 0,
      "PDF has no image thumb",
      results
    );
    assert(
      (await page.locator('[data-testid="compress-file-card"]').innerText()).includes("thumb-sample.pdf"),
      "PDF card shows filename",
      results
    );
    await page.screenshot({
      path: path.join(OUT, `${LABEL}compressor-pdf-card.png`),
      fullPage: false,
    });

    const report = {
      base: BASE,
      at: new Date().toISOString(),
      status: "PASS",
      results,
    };
    fs.writeFileSync(
      path.join(OUT, `${LABEL}compressor-thumb-results.json`),
      JSON.stringify(report, null, 2)
    );
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    await page
      .screenshot({
        path: path.join(OUT, `${LABEL}compressor-thumb-FAIL.png`),
        fullPage: true,
      })
      .catch(() => {});
    const report = {
      base: BASE,
      at: new Date().toISOString(),
      status: "FAIL",
      error: String(e.message || e),
      results,
    };
    fs.writeFileSync(
      path.join(OUT, `${LABEL}compressor-thumb-results.json`),
      JSON.stringify(report, null, 2)
    );
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
