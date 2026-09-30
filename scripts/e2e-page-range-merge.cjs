/**
 * Page-range merge UX — 3 requirements:
 * 1) From/To clearable mid-edit (no forced `1`); validate on blur
 * 2) Non-contiguous ordered selection via chips + comma list
 * 3) Merge preview before download
 *
 *   BASE_URL=http://127.0.0.1:43127 PROOF_LABEL=local- \
 *     node scripts/e2e-page-range-merge.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts } = require("pdf-lib");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43127";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";
const FIX = path.join(OUT, "_page-range-fixtures");
const LABEL = process.env.PROOF_LABEL || "page-range-";
const FAKE_EMAIL = "bapattanmay@gmail.com";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function unlockAuthAndPremium(page) {
  const fakeUser = {
    id: "e2e-page-range",
    name: "Page Range QA",
    email: FAKE_EMAIL,
    timeSpentSeconds: 0,
    featuresUsed: ["premium"],
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
        usageSessionId: "e2e-pr-sid",
      }),
    })
  );
  await page.route("**/api/track", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, featuresUsed: fakeUser.featuresUsed }),
    })
  );
  await page.route("**/api/premium", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          isPremium: true,
          source: "upgrade",
          email: FAKE_EMAIL,
          note: "e2e mock",
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        isPremium: true,
        source: "allowlist",
        email: FAKE_EMAIL,
      }),
    });
  });
}

async function makePdf(filePath, pages, label) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`${label} PAGE ${i + 1}`, {
      x: 72,
      y: 720,
      size: 28,
      font,
    });
  }
  fs.writeFileSync(filePath, Buffer.from(await doc.save()));
}

async function openPageMerge(page) {
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
    .filter({ hasText: /Page-range merge/i })
    .first()
    .click();
  await page.waitForTimeout(600);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(FIX, { recursive: true });
  const file1 = path.join(FIX, "file1.pdf");
  const file2 = path.join(FIX, "file2.pdf");
  await makePdf(file1, 9, "FILE1");
  await makePdf(file2, 9, "FILE2");

  const results = {
    at: new Date().toISOString(),
    base: BASE,
    req1_typing: { pass: false, detail: "" },
    req2_noncontiguous: { pass: false, detail: "" },
    req3_preview: { pass: false, detail: "" },
    status: "FAIL",
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await unlockAuthAndPremium(page);

  try {
    await openPageMerge(page);
    await page
      .locator('#tools input[type="file"]')
      .last()
      .setInputFiles([file1, file2]);
    await page.waitForSelector('[data-testid="page-merge-row"]', {
      timeout: 15000,
    });
    const rows = page.locator('[data-testid="page-merge-row"]');
    assert((await rows.count()) === 2, "expected 2 merge rows");

    // ─── Req 1: From/To clearable, single-digit typing ───
    const from0 = rows.nth(0).locator('[data-testid="page-merge-from"]');
    const to0 = rows.nth(0).locator('[data-testid="page-merge-to"]');
    await from0.click({ clickCount: 3 });
    await from0.press("Backspace");
    await from0.press("Backspace");
    await from0.press("Backspace");
    let midValue = await from0.inputValue();
    // After clear, must NOT snap back to "1" while focused/editing
    assert(midValue === "", `From still forced after clear: "${midValue}"`);
    await page.screenshot({
      path: path.join(OUT, `${LABEL}req1-from-cleared.png`),
    });

    // Type single digit "5" without it becoming "15" or snapping
    await from0.fill("5");
    assert((await from0.inputValue()) === "5", "single digit 5 not kept");
    await to0.fill("");
    assert((await to0.inputValue()) === "", "To not clearable");
    await to0.fill("5");
    assert((await to0.inputValue()) === "5", "To single digit");
    // blur commits contiguous range 5-5
    await to0.blur();
    await page.waitForTimeout(200);
    const orderAfterBlur = await rows
      .nth(0)
      .locator("text=/Selected order:/")
      .innerText();
    assert(/5/.test(orderAfterBlur), `blur commit failed: ${orderAfterBlur}`);
    results.req1_typing = {
      pass: true,
      detail: `clearable + single digit; after blur: ${orderAfterBlur.trim()}`,
    };
    console.log("PASS  req1 typing —", results.req1_typing.detail);
    await page.screenshot({
      path: path.join(OUT, `${LABEL}req1-typing-ok.png`),
    });

    // ─── Req 2: Non-contiguous chips + comma list, merge order ───
    // Reset file1 via comma list: 1,5,8
    const list0 = rows.nth(0).locator('[data-testid="page-merge-list"]');
    await list0.fill("1,5,8");
    await list0.blur();
    await page.waitForTimeout(200);
    let sel0 = await rows.nth(0).locator("text=/Selected order:/").innerText();
    assert(
      /1\s*→\s*5\s*→\s*8/.test(sel0),
      `file1 order wrong after list: ${sel0}`
    );

    // file2: click chips in order 2, then 4, then 9 (deselect defaults first)
    const chips1 = rows.nth(1).locator('[data-testid="page-merge-chips"] button');
    const chipCount = await chips1.count();
    assert(chipCount >= 9, `file2 chips=${chipCount}`);
    // Clear all selected by clicking each pressed chip
    for (let i = 0; i < chipCount; i++) {
      const pressed = await chips1.nth(i).getAttribute("aria-pressed");
      if (pressed === "true") await chips1.nth(i).click();
    }
    await page.waitForTimeout(100);
    // Click 2, 4, 9 (0-based indices 1, 3, 8)
    await chips1.nth(1).click(); // page 2
    await chips1.nth(3).click(); // page 4
    await chips1.nth(8).click(); // page 9
    await page.waitForTimeout(200);
    let sel1 = await rows.nth(1).locator("text=/Selected order:/").innerText();
    assert(
      /2\s*→\s*4\s*→\s*9/.test(sel1),
      `file2 chip order wrong: ${sel1}`
    );
    results.req2_noncontiguous = {
      pass: true,
      detail: `file1 ${sel0.trim()} | file2 ${sel1.trim()}`,
    };
    console.log("PASS  req2 non-contiguous —", results.req2_noncontiguous.detail);
    await page.screenshot({
      path: path.join(OUT, `${LABEL}req2-chips-order.png`),
      fullPage: true,
    });

    // ─── Req 3: Preview before download ───
    const preview = page.locator('[data-testid="page-merge-preview"]');
    await preview.waitFor({ state: "visible", timeout: 5000 });
    const previewText = await preview.innerText();
    assert(/MERGE PREVIEW/i.test(previewText), "missing MERGE PREVIEW heading");
    assert(
      /1,\s*5,\s*8/.test(previewText) || /1 → 5 → 8/.test(previewText) ||
        (/1/.test(previewText) && /5/.test(previewText) && /8/.test(previewText)),
      `preview missing file1 pages: ${previewText.slice(0, 200)}`
    );
    assert(
      /2,\s*4,\s*9/.test(previewText) ||
        (/2/.test(previewText) && /4/.test(previewText) && /9/.test(previewText)),
      `preview missing file2 pages: ${previewText.slice(0, 200)}`
    );
    assert(
      /Total output pages \(planned\):\s*6/i.test(previewText),
      `planned total not 6: ${previewText.slice(0, 200)}`
    );

    // Download button must NOT appear before merge
    const dlBefore = await page
      .locator('[data-testid="premium-page-range-download"]')
      .isVisible()
      .catch(() => false);
    assert(!dlBefore, "Download visible before merge/confirm");

    await page.locator('[data-testid="page-merge-run"]').click();
    await page
      .locator('[data-testid="premium-page-range-download"]')
      .waitFor({ state: "visible", timeout: 60000 });

    const previewAfter = await preview.innerText();
    assert(
      /1,\s*5,\s*8/.test(previewAfter) && /2,\s*4,\s*9/.test(previewAfter),
      `post-merge preview lost page plan: ${previewAfter.slice(0, 240)}`
    );

    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      page.locator('[data-testid="premium-page-range-download"]').click(),
    ]);
    const outPdf = path.join(OUT, `${LABEL}merged.pdf`);
    await dl.saveAs(outPdf);
    const doc = await PDFDocument.load(fs.readFileSync(outPdf));
    const pc = doc.getPageCount();
    assert(pc === 6, `merged PDF pages=${pc} expect 6 (1,5,8 + 2,4,9)`);
    const uiMergedOk = /Merged file:\s*6 pages/i.test(previewAfter);

    results.req3_preview = {
      pass: true,
      detail: `preview showed 1,5,8 + 2,4,9; PDF ${pc} pages; uiCount=${uiMergedOk ? "6" : "planned-ok"}; download after confirm`,
    };
    console.log("PASS  req3 preview —", results.req3_preview.detail);
    await page.screenshot({
      path: path.join(OUT, `${LABEL}req3-preview-download.png`),
      fullPage: true,
    });

    results.status =
      results.req1_typing.pass &&
      results.req2_noncontiguous.pass &&
      results.req3_preview.pass
        ? "PASS"
        : "FAIL";
  } catch (e) {
    console.error("FAIL", e.message || e);
    await page
      .screenshot({
        path: path.join(OUT, `${LABEL}FAIL.png`),
        fullPage: true,
      })
      .catch(() => {});
    if (!results.req1_typing.pass) {
      results.req1_typing.detail = String(e.message || e);
    } else if (!results.req2_noncontiguous.pass) {
      results.req2_noncontiguous.detail = String(e.message || e);
    } else if (!results.req3_preview.pass) {
      results.req3_preview.detail = String(e.message || e);
    }
    results.status = "FAIL";
  } finally {
    await browser.close();
  }

  const jsonPath = path.join(OUT, `${LABEL}results.json`);
  const txtPath = path.join(OUT, `${LABEL}results.txt`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  const lines = [
    `Page-range merge UX — ${results.status}`,
    `base: ${BASE}`,
    `at: ${results.at}`,
    `1. Typing: ${results.req1_typing.pass ? "PASS" : "FAIL"} — ${results.req1_typing.detail}`,
    `2. Non-contiguous: ${results.req2_noncontiguous.pass ? "PASS" : "FAIL"} — ${results.req2_noncontiguous.detail}`,
    `3. Preview: ${results.req3_preview.pass ? "PASS" : "FAIL"} — ${results.req3_preview.detail}`,
  ];
  fs.writeFileSync(txtPath, lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  if (results.status !== "PASS") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
