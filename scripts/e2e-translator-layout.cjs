/**
 * Translator layout: long DOCX must scroll inside preview, not stretch the page.
 *
 *   BASE_URL=https://convert-my-file-oo3r.onrender.com PROOF_LABEL=live- node scripts/e2e-translator-layout.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43127";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";
const FIX = path.join(OUT, "_layout-fixtures");
const LABEL = process.env.PROOF_LABEL || "";

function assert(cond, msg, results) {
  if (!cond) throw new Error(msg);
  results.push("PASS: " + msg);
}

async function buildLongDocx(filePath) {
  const JSZip = require("jszip");
  const paragraphs = [];
  for (let i = 1; i <= 80; i++) {
    paragraphs.push(
      `<w:p><w:r><w:t>Paragraph ${i}: Platform Code Review checklist item covering architecture, security, performance, and maintainability for Convert My File.</w:t></w:r></w:p>`
    );
  }
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.folder("_rels").file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder("word").file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs.join("")}</w:body>
</w:document>`
  );
  fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer" }));
}

async function unlockAuth(page) {
  const fakeUser = {
    id: "e2e-qa-user",
    name: "E2E QA",
    email: "e2e-qa@convertmyfile.test",
    timeSpentSeconds: 0,
    featuresUsed: ["translator"],
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
  const docx = path.join(FIX, "long-review.docx");
  await buildLongDocx(docx);
  const results = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await unlockAuth(page);

  try {
    await page.goto(BASE + "/#tools", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator("#tools").scrollIntoViewIfNeeded();
    await page
      .getByText("Google login for Premium")
      .waitFor({ state: "hidden", timeout: 20000 })
      .catch(() => {});
    await page.getByRole("tab", { name: "Translator" }).click();
    await page.waitForTimeout(400);

    await page.locator('#tools input[type="file"]').first().setInputFiles(docx);
    await page.waitForTimeout(1200);

    const metrics = await page.evaluate(() => {
      const src = document.querySelector('[data-testid="source-preview"]');
      const left = document.querySelector("#tools .grid > div");
      const lang = Array.from(document.querySelectorAll("#tools label")).find((l) =>
        /OUTPUT LANGUAGE/i.test(l.textContent || "")
      );
      const upload = Array.from(document.querySelectorAll("#tools button")).find((b) =>
        /Upload Word|Drop a file/i.test(b.textContent || "")
      );
      if (!src || !left || !lang || !upload) {
        return { error: "missing nodes", hasSrc: !!src, hasLeft: !!left, hasLang: !!lang, hasUpload: !!upload };
      }
      const srcRect = src.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      const langRect = lang.getBoundingClientRect();
      const uploadRect = upload.getBoundingClientRect();
      const gap = langRect.top - uploadRect.bottom;
      return {
        srcClientH: src.clientHeight,
        srcScrollH: src.scrollHeight,
        srcOverflowY: getComputedStyle(src).overflowY,
        srcMaxH: getComputedStyle(src).maxHeight,
        leftH: leftRect.height,
        srcPanelH: srcRect.height,
        gapUploadToLang: gap,
        pageScrollH: document.documentElement.scrollHeight,
      };
    });

    assert(!metrics.error, "layout nodes present", results);
    assert(
      metrics.srcOverflowY === "auto" || metrics.srcOverflowY === "scroll",
      `source preview overflow-y=${metrics.srcOverflowY}`,
      results
    );
    assert(
      metrics.srcScrollH > metrics.srcClientH + 20,
      `source scrolls (scroll=${metrics.srcScrollH} > client=${metrics.srcClientH})`,
      results
    );
    assert(
      metrics.srcClientH <= 200,
      `source panel capped (~max-h-44): clientH=${Math.round(metrics.srcClientH)}`,
      results
    );
    assert(
      metrics.gapUploadToLang < 120,
      `no stretched blank gap upload→language (${Math.round(metrics.gapUploadToLang)}px)`,
      results
    );
    assert(
      metrics.leftH < 720,
      `left column not page-tall (${Math.round(metrics.leftH)}px)`,
      results
    );

    await page.screenshot({
      path: path.join(OUT, `${LABEL}translator-layout-long-docx.png`),
      fullPage: false,
    });

    // Translate briefly to ensure translated panel also scrolls
    await page.getByRole("button", { name: /Translate & preview/i }).click();
    await page.waitForSelector('[data-testid="translated-preview"]', { timeout: 90000 });
    await page.waitForTimeout(2000);
    const tMetrics = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="translated-preview"]');
      if (!el) return null;
      return {
        clientH: el.clientHeight,
        scrollH: el.scrollHeight,
        overflowY: getComputedStyle(el).overflowY,
      };
    });
    if (tMetrics && tMetrics.scrollH > tMetrics.clientH + 10) {
      assert(
        tMetrics.overflowY === "auto" || tMetrics.overflowY === "scroll",
        "translated preview scrolls when long",
        results
      );
    } else {
      results.push("PASS: translated preview present (may be shorter after free-tier truncate)");
    }

    await page.screenshot({
      path: path.join(OUT, `${LABEL}translator-layout-after-translate.png`),
      fullPage: false,
    });

    const report = {
      base: BASE,
      at: new Date().toISOString(),
      status: "PASS",
      metrics,
      tMetrics,
      results,
    };
    fs.writeFileSync(
      path.join(OUT, `${LABEL}translator-layout-results.json`),
      JSON.stringify(report, null, 2)
    );
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    await page
      .screenshot({
        path: path.join(OUT, `${LABEL}translator-layout-FAIL.png`),
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
      path.join(OUT, `${LABEL}translator-layout-results.json`),
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
