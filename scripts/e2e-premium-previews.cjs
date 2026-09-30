/**
 * Premium desk — every feature exposes Preview; multi-page PDF nav works.
 *
 *   BASE_URL=http://127.0.0.1:43127 PROOF_LABEL=prem-prev- \
 *     node scripts/e2e-premium-previews.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43127";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";
const FIX = path.join(OUT, "_premium-preview-fixtures");
const LABEL = process.env.PROOF_LABEL || "prem-prev-";
const FAKE_EMAIL = "bapattanmay@gmail.com";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function unlock(page) {
  const fakeUser = {
    id: "e2e-prev",
    name: "Preview QA",
    email: FAKE_EMAIL,
    timeSpentSeconds: 0,
    featuresUsed: ["premium"],
    location: { source: "e2e" },
  };
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: fakeUser, googleConfigured: true }),
    })
  );
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { name: fakeUser.name, email: fakeUser.email },
        expires: new Date(Date.now() + 864e5).toISOString(),
        usageSessionId: "e2e-prev",
      }),
    })
  );
  await page.route("**/api/track", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  );
  await page.route("**/api/premium", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        isPremium: true,
        source: "allowlist",
        email: FAKE_EMAIL,
      }),
    })
  );
  await page.route("**/api/translate", async (route) => {
    const body = route.request().postDataJSON() || {};
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        translatedText: `[${body.target || "xx"}] ${body.text || "ok"}`,
        provider: "e2e-mock",
      }),
    });
  });
}

async function makePdf(filePath, pages, label) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([612, 792]);
    p.drawText(`${label} PAGE ${i + 1}`, {
      x: 72,
      y: 720,
      size: 22,
      font,
      color: rgb(0.06, 0.09, 0.16),
    });
  }
  fs.writeFileSync(filePath, Buffer.from(await doc.save()));
}

async function makePng(filePath) {
  // Minimal 1x1 PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  fs.writeFileSync(filePath, png);
}

async function openPremium(page, titleRe) {
  await page.goto(BASE + "/#tools", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.evaluate((email) => {
    try {
      localStorage.setItem(
        "cmf_premium_emails",
        JSON.stringify([email.toLowerCase()])
      );
    } catch (_) {}
  }, FAKE_EMAIL);
  await page.locator("#tools").scrollIntoViewIfNeeded();
  await page
    .getByText("Google login required")
    .waitFor({ state: "hidden", timeout: 25000 })
    .catch(() => {});
  await page.getByRole("tab", { name: "Premium", exact: true }).click();
  await page
    .getByText(/Premium active/i)
    .first()
    .waitFor({ timeout: 45000 });
  await page
    .locator("button")
    .filter({ hasText: titleRe })
    .first()
    .click();
  await page.waitForTimeout(400);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(FIX, { recursive: true });
  const pdfA = path.join(FIX, "multi-a.pdf");
  const pdfB = path.join(FIX, "multi-b.pdf");
  const png = path.join(FIX, "dot.png");
  const txt = path.join(FIX, "note.txt");
  await makePdf(pdfA, 4, "DOC-A");
  await makePdf(pdfB, 3, "DOC-B");
  await makePng(png);
  fs.writeFileSync(txt, "Hello premium preview pack.\n");

  const status = {};
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await unlock(page);

  const mark = (id, pass, detail) => {
    status[id] = { pass: !!pass, detail: String(detail).slice(0, 200) };
    console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${String(detail).slice(0, 140)}`);
  };

  try {
    // 1) Batch convert → ZIP
    try {
      await openPremium(page, /Batch convert/i);
      await page.locator('#tools input[type="file"]').last().setInputFiles([txt, png]);
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: /Convert to ZIP/i }).click();
      await page
        .locator('[data-testid="premium-preview-batch"]')
        .waitFor({ state: "visible", timeout: 90000 });
      await page
        .locator('[data-testid="premium-preview-batch-zip-list"]')
        .waitFor({ state: "visible", timeout: 15000 });
      mark("batch", true, "ZIP list preview visible");
    } catch (e) {
      mark("batch", false, e.message || e);
    }

    // 2) PDF editor
    try {
      await openPremium(page, /PDF editor/i);
      await page.locator('[data-testid="premium-pdf-open"]').setInputFiles(pdfA);
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: /Export edited PDF/i }).click();
      await page
        .locator('[data-testid="premium-preview-pdf-editor"]')
        .waitFor({ state: "visible", timeout: 60000 });
      await page
        .locator('[data-testid="premium-preview-pdf-editor-page-image"]')
        .waitFor({ state: "visible", timeout: 30000 });
      mark("pdf-editor", true, "edited PDF page preview");
    } catch (e) {
      mark("pdf-editor", false, e.message || e);
    }

    // 3) 5-language batch
    try {
      await openPremium(page, /5-language/i);
      await page.locator("#tools textarea").fill("Preview translation pack.");
      await page.getByRole("button", { name: /Translate batch/i }).click();
      await page
        .locator('[data-testid="premium-preview-multi-lang"]')
        .waitFor({ state: "visible", timeout: 120000 });
      const textPrev = await page
        .locator('[data-testid="premium-preview-multi-lang-text"]')
        .isVisible()
        .catch(() => false);
      mark("multi-lang", true, `pack preview + text cards=${textPrev}`);
    } catch (e) {
      mark("multi-lang", false, e.message || e);
    }

    // 4) Page-range merge + multi-page nav
    try {
      await openPremium(page, /Page-range merge/i);
      await page
        .locator('#tools input[type="file"]')
        .last()
        .setInputFiles([pdfA, pdfB]);
      await page.waitForTimeout(1200);
      await page.locator('[data-testid="page-merge-run"]').click();
      await page
        .locator('[data-testid="premium-preview-page-merge"]')
        .waitFor({ state: "visible", timeout: 60000 });
      await page
        .locator('[data-testid="premium-preview-page-merge-pager"]')
        .waitFor({ state: "visible", timeout: 30000 });
      const ind = await page
        .locator('[data-testid="premium-preview-page-merge-page-indicator"]')
        .innerText();
      assert(/Page 1 of \d+/i.test(ind), `indicator ${ind}`);
      await page.locator('[data-testid="premium-preview-page-merge-next"]').click();
      await page.waitForTimeout(800);
      const ind2 = await page
        .locator('[data-testid="premium-preview-page-merge-page-indicator"]')
        .innerText();
      assert(/Page 2 of/i.test(ind2), `after next: ${ind2}`);
      await page.screenshot({
        path: path.join(OUT, `${LABEL}page-merge-multipage.png`),
        fullPage: true,
      });
      mark("page-merge", true, `multi-page nav ${ind} → ${ind2}`);
    } catch (e) {
      mark("page-merge", false, e.message || e);
      await page
        .screenshot({
          path: path.join(OUT, `${LABEL}page-merge-FAIL.png`),
          fullPage: true,
        })
        .catch(() => {});
    }

    // 5) Merge + compress
    try {
      await openPremium(page, /Merge \+ compress/i);
      await page
        .locator('#tools input[type="file"]')
        .last()
        .setInputFiles([pdfA, pdfB]);
      await page.locator('[data-testid="premium-merge-compress-kb"]').fill("80");
      await page.getByRole("button", { name: /Merge & compress/i }).click();
      await page
        .locator('[data-testid="premium-preview-merge-compress"]')
        .waitFor({ state: "visible", timeout: 90000 });
      const pager = await page
        .locator('[data-testid="premium-preview-merge-compress-pager"]')
        .isVisible()
        .catch(() => false);
      const img = await page
        .locator('[data-testid="premium-preview-merge-compress-page-image"]')
        .isVisible()
        .catch(() => false);
      mark("merge-compress", img, `preview image=${img} pager=${pager}`);
      if (pager) {
        await page
          .locator('[data-testid="premium-preview-merge-compress-next"]')
          .click()
          .catch(() => {});
      }
    } catch (e) {
      mark("merge-compress", false, e.message || e);
    }

    // 6) Digital signature
    try {
      await openPremium(page, /Digital signature/i);
      await page.locator('#tools input[type="file"]').last().setInputFiles(pdfA);
      await page.waitForTimeout(600);
      await page.locator('[data-testid="sign-apply"]').click();
      await page
        .locator('[data-testid="sign-preview"]')
        .waitFor({ state: "visible", timeout: 60000 });
      await page
        .locator('[data-testid="sign-preview-page-image"]')
        .waitFor({ state: "visible", timeout: 30000 });
      mark("sign", true, "SIGNED PREVIEW with page image");
    } catch (e) {
      mark("sign", false, e.message || e);
    }

    // 7) Quality
    try {
      await openPremium(page, /Quality before/i);
      await page.locator('#tools input[type="file"]').last().setInputFiles(png);
      await page
        .locator('[data-testid="premium-preview-quality"]')
        .waitFor({ state: "visible", timeout: 30000 });
      await page
        .locator('[data-testid="premium-preview-quality-after"]')
        .waitFor({ state: "visible", timeout: 30000 });
      mark("quality", true, "before/after QUALITY PREVIEW");
    } catch (e) {
      mark("quality", false, e.message || e);
    }

    // 8) Video & audio — use tiny mp3 if present else skip with note
    try {
      const mp3 = path.join(
        OUT,
        "_full-matrix-fixtures",
        "sample.mp3"
      );
      const mediaPath = fs.existsSync(mp3) ? mp3 : null;
      if (!mediaPath) {
        // synthesize tiny bytes labeled mp3 for resize path
        const synth = path.join(FIX, "tone.mp3");
        fs.writeFileSync(synth, Buffer.alloc(2048, 1));
        await openPremium(page, /Video & audio/i);
        await page.locator('#tools input[type="file"]').last().setInputFiles(synth);
        await page.locator('[data-testid="premium-media-mb"]').fill("1");
        await page.getByRole("button", { name: /Resize media/i }).click();
        await page
          .locator('[data-testid="premium-preview-media"]')
          .waitFor({ state: "visible", timeout: 60000 });
        mark("media", true, "MEDIA PREVIEW after resize");
      } else {
        await openPremium(page, /Video & audio/i);
        await page.locator('#tools input[type="file"]').last().setInputFiles(mediaPath);
        await page.locator('[data-testid="premium-media-mb"]').fill("1");
        await page.getByRole("button", { name: /Resize media/i }).click();
        await page
          .locator('[data-testid="premium-preview-media"]')
          .waitFor({ state: "visible", timeout: 60000 });
        mark("media", true, "MEDIA PREVIEW after resize");
      }
    } catch (e) {
      mark("media", false, e.message || e);
    }

    // 9) Bulk
    try {
      await openPremium(page, /Bulk per-file/i);
      await page
        .locator('#tools input[type="file"]')
        .last()
        .setInputFiles([png, txt]);
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: /Compress bulk ZIP/i }).click();
      await page
        .locator('[data-testid="premium-preview-bulk"]')
        .waitFor({ state: "visible", timeout: 90000 });
      await page
        .locator('[data-testid="premium-preview-bulk-zip-list"]')
        .waitFor({ state: "visible", timeout: 15000 });
      mark("bulk", true, "BULK ZIP PREVIEW list");
    } catch (e) {
      mark("bulk", false, e.message || e);
    }

    await page.screenshot({
      path: path.join(OUT, `${LABEL}final.png`),
      fullPage: true,
    });
  } finally {
    await browser.close();
  }

  const ids = [
    "batch",
    "pdf-editor",
    "multi-lang",
    "page-merge",
    "merge-compress",
    "sign",
    "quality",
    "media",
    "bulk",
  ];
  const allPass = ids.every((id) => status[id]?.pass);
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    status: allPass ? "PASS" : "FAIL",
    features: status,
  };
  fs.writeFileSync(
    path.join(OUT, `${LABEL}results.json`),
    JSON.stringify(report, null, 2)
  );
  const lines = [
    `Premium previews — ${report.status}`,
    `base: ${BASE}`,
    ...ids.map(
      (id) =>
        `${status[id]?.pass ? "PASS" : "FAIL"}  ${id} — ${status[id]?.detail || "missing"}`
    ),
  ];
  fs.writeFileSync(path.join(OUT, `${LABEL}results.txt`), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
