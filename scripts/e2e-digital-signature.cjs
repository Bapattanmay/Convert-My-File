/**
 * Digital signature polish:
 * 0) Same page as last content (no blank page 2) for short multi-line docs
 * 1) Near end of content (minimal blank gap)
 * 2) No overlap with existing content
 * 3) Plain body font/color; no bordered box / Digitally signed / OK badge
 *
 *   BASE_URL=http://127.0.0.1:43127 PROOF_LABEL=sign- \
 *     node scripts/e2e-digital-signature.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const {
  PDFDocument,
  PDFArray,
  PDFRawStream,
  StandardFonts,
  decodePDFRawStream,
  rgb,
} = require("pdf-lib");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43127";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";
const FIX = path.join(OUT, "_sign-fixtures");
const LABEL = process.env.PROOF_LABEL || "sign-";
const FAKE_EMAIL = "bapattanmay@gmail.com";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function unlockAuthAndPremium(page) {
  const fakeUser = {
    id: "e2e-sign",
    name: "Sign QA",
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
        usageSessionId: "e2e-sign-sid",
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
  await page.route("**/api/premium", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        isPremium: true,
        source: "allowlist",
        email: FAKE_EMAIL,
      }),
    })
  );
}

function readContent(page) {
  const contents = page.node.Contents();
  if (!contents) return "";
  const refs = [];
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) refs.push(contents.get(i));
  } else refs.push(contents);
  let out = "";
  for (const ref of refs) {
    try {
      const raw = page.doc.context.lookup(ref, PDFRawStream);
      const decoded = decodePDFRawStream(raw).decode();
      out += Buffer.from(decoded).toString("latin1") + "\n";
    } catch (_) {}
  }
  return out;
}

function lowestTextY(content, pageHeight) {
  let minY = Infinity;
  let curY = pageHeight;
  let leading = 14;
  const tokens = content.match(/[^\s]+/g) || [];
  const nums = [];
  for (const tok of tokens) {
    if (/^-?\d*\.?\d+$/.test(tok) && Number.isFinite(Number(tok))) {
      nums.push(Number(tok));
      continue;
    }
    if (tok === "TL" && nums.length >= 1) {
      leading = Math.abs(nums[nums.length - 1]);
      nums.length = 0;
      continue;
    }
    if (tok === "Tm" && nums.length >= 6) {
      curY = nums[nums.length - 1];
      minY = Math.min(minY, curY);
      nums.length = 0;
      continue;
    }
    if ((tok === "Td" || tok === "TD") && nums.length >= 2) {
      curY += nums[nums.length - 1];
      minY = Math.min(minY, curY);
      nums.length = 0;
      continue;
    }
    if (tok === "T*") {
      curY -= leading;
      minY = Math.min(minY, curY);
      nums.length = 0;
      continue;
    }
    if (/^[A-Za-z'"]/.test(tok)) nums.length = 0;
  }
  return Number.isFinite(minY) ? minY : null;
}

function findSignedBaselines(content) {
  // After signing, look for Tm y values near "Signed:" draws — collect all Tm y
  const ys = [];
  const tm = content.matchAll(
    /([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s+Tm/g
  );
  for (const m of tm) ys.push(Number(m[6]));
  return ys.filter((y) => Number.isFinite(y));
}

async function makeSalaryPdf(filePath) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  const color = rgb(0.06, 0.09, 0.16);
  const lines = [
    [720, "Salary Slip — March 2026"],
    [700, "Employee: Tanmay Bapat"],
    [680, "Department: Engineering"],
    [660, "Basic: 50,000"],
    [640, "HRA: 20,000"],
    [620, "Special Allowance: 8,000"],
    [600, "Net Pay: 62,000"],
    [580, "Notes: Paid via bank transfer on the last working day."],
  ];
  for (const [y, text] of lines) {
    page.drawText(text, { x: 50, y, size: 11, font, color });
  }
  // Footer-like line that must NOT push the signature onto a new page
  page.drawText("Page 1 of 1", {
    x: 50,
    y: 36,
    size: 9,
    font,
    color,
  });
  fs.writeFileSync(filePath, Buffer.from(await doc.save()));
}

async function openSign(page) {
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
    .filter({ hasText: /Digital signature/i })
    .first()
    .click();
  await page.waitForTimeout(600);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(FIX, { recursive: true });
  const pdfPath = path.join(FIX, "salary.pdf");
  await makeSalaryPdf(pdfPath);

  const results = {
    at: new Date().toISOString(),
    base: BASE,
    req0_same_page: { pass: false, detail: "" },
    req1_near_content: { pass: false, detail: "" },
    req2_no_overlap: { pass: false, detail: "" },
    req3_plain_style: { pass: false, detail: "" },
    status: "FAIL",
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await unlockAuthAndPremium(page);

  try {
    await openSign(page);
    await page
      .locator('#tools input[type="file"]')
      .last()
      .setInputFiles(pdfPath);
    await page.waitForTimeout(800);
    await page.locator('[data-testid="sign-name"]').fill("Tanmay Bapat");
    await page.locator('[data-testid="sign-reason"]').fill("Salary approved");
    await page.locator('[data-testid="sign-apply"]').click();
    await page
      .locator('[data-testid="sign-download"]')
      .waitFor({ state: "visible", timeout: 45000 });
    // Preview must appear before download confirmation
    await page
      .locator('[data-testid="sign-preview"]')
      .waitFor({ state: "visible", timeout: 30000 });
    await page
      .locator('[data-testid="sign-preview-page-image"]')
      .waitFor({ state: "visible", timeout: 30000 });
    const previewText = await page.locator('[data-testid="sign-preview"]').innerText();
    assert(/SIGNED PREVIEW/i.test(previewText), "missing SIGNED PREVIEW");
    const pageCountLabel = await page
      .locator('[data-testid="sign-preview-meta"]')
      .innerText();
    assert(/1 page/i.test(pageCountLabel), `page count label: ${pageCountLabel}`);
    await page.screenshot({
      path: path.join(OUT, `${LABEL}preview.png`),
      fullPage: true,
    });

    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      page.locator('[data-testid="sign-download"]').click(),
    ]);
    const outPdf = path.join(OUT, `${LABEL}signed-salary.pdf`);
    await dl.saveAs(outPdf);

    const signed = await PDFDocument.load(fs.readFileSync(outPdf));
    const pageCount = signed.getPageCount();
    assert(pageCount === 1, `expected 1 page, got ${pageCount}`);
    results.req0_same_page = {
      pass: true,
      detail: `output pages=${pageCount}; SIGNED PREVIEW shown before download (${pageCountLabel.trim()})`,
    };
    console.log("PASS  req0 same page + preview —", results.req0_same_page.detail);
    fs.writeFileSync(
      path.join(OUT, `${LABEL}page-count.txt`),
      `pages=${pageCount}\npreview=1\n`
    );

    const last = signed.getPages()[0];
    const { height } = last.getSize();
    const content = readContent(last);
    const ys = findSignedBaselines(content);
    const contentBottomBeforeSign = 580; // last salary body line in fixture

    const ascii = content.replace(/<([0-9A-Fa-f]+)>/g, (_, h) => {
      try {
        return Buffer.from(h, "hex").toString("latin1");
      } catch {
        return "";
      }
    });

    const hasDigitallySigned = /Digitally signed/i.test(ascii);
    const hasOkBadge =
      /\bOK\b/.test(content) && /0\.1\s+0\.45\s+0\.25/.test(content);
    const hasRect =
      /\bre\b/.test(content) && /0\.12\s+0\.35\s+0\.55/.test(content);
    const hasItalic = /HelveticaOblique|Oblique/i.test(content);
    const hasBlueStamp = /0\.05\s+0\.15\s+0\.3\s+rg|0\.12\s+0\.35\s+0\.55/.test(
      content
    );

    const sigYs = ys.filter(
      (y) => y < contentBottomBeforeSign - 5 && y > 80
    );
    const topSigY = sigYs.length ? Math.max(...sigYs) : null;

    const nearContent =
      topSigY != null &&
      topSigY <= contentBottomBeforeSign - 8 &&
      topSigY >= contentBottomBeforeSign - 80 &&
      topSigY > height * 0.2;
    results.req1_near_content = {
      pass: !!nearContent,
      detail: nearContent
        ? `sigY=${topSigY.toFixed(1)} under contentY=${contentBottomBeforeSign} (pageH=${height})`
        : `sigY=${topSigY} ys=${ys.join(",")} — expected under ~580 on page 1`,
    };
    console.log(
      (nearContent ? "PASS" : "FAIL") + "  req1 near content —",
      results.req1_near_content.detail
    );

    const noOverlap =
      topSigY != null && topSigY <= contentBottomBeforeSign - 8;
    results.req2_no_overlap = {
      pass: !!noOverlap,
      detail: noOverlap
        ? `gap=${(contentBottomBeforeSign - topSigY).toFixed(1)}pt below content`
        : `overlap risk sigY=${topSigY} contentY=${contentBottomBeforeSign}`,
    };
    console.log(
      (noOverlap ? "PASS" : "FAIL") + "  req2 no overlap —",
      results.req2_no_overlap.detail
    );

    const plain =
      !hasDigitallySigned &&
      !hasOkBadge &&
      !hasRect &&
      !hasItalic &&
      !hasBlueStamp &&
      /Signed:/.test(ascii);
    results.req3_plain_style = {
      pass: !!plain,
      detail: plain
        ? "plain Signed:/Reason lines; no box/OK/italic/blue stamp"
        : `chrome flags digitallySigned=${hasDigitallySigned} ok=${hasOkBadge} rect=${hasRect} italic=${hasItalic} blue=${hasBlueStamp}`,
    };
    console.log(
      (plain ? "PASS" : "FAIL") + "  req3 plain style —",
      results.req3_plain_style.detail
    );

    await page.screenshot({
      path: path.join(OUT, `${LABEL}ui.png`),
      fullPage: true,
    });
    fs.writeFileSync(
      path.join(OUT, `${LABEL}content-dump.txt`),
      ascii.slice(0, 2000)
    );

    results.status =
      results.req0_same_page.pass &&
      results.req1_near_content.pass &&
      results.req2_no_overlap.pass &&
      results.req3_plain_style.pass
        ? "PASS"
        : "FAIL";
  } catch (e) {
    console.error("FAIL", e.message || e);
    await page
      .screenshot({ path: path.join(OUT, `${LABEL}FAIL.png`), fullPage: true })
      .catch(() => {});
    const msg = String(e.message || e);
    if (!results.req0_same_page.pass) results.req0_same_page.detail = msg;
    else if (!results.req1_near_content.pass)
      results.req1_near_content.detail = msg;
    else if (!results.req2_no_overlap.pass) results.req2_no_overlap.detail = msg;
    else results.req3_plain_style.detail = msg;
    results.status = "FAIL";
  } finally {
    await browser.close();
  }

  const jsonPath = path.join(OUT, `${LABEL}results.json`);
  const txtPath = path.join(OUT, `${LABEL}results.txt`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  const lines = [
    `Digital signature polish — ${results.status}`,
    `base: ${BASE}`,
    `at: ${results.at}`,
    `0. Same page: ${results.req0_same_page.pass ? "PASS" : "FAIL"} — ${results.req0_same_page.detail}`,
    `1. Near content: ${results.req1_near_content.pass ? "PASS" : "FAIL"} — ${results.req1_near_content.detail}`,
    `2. No overlap: ${results.req2_no_overlap.pass ? "PASS" : "FAIL"} — ${results.req2_no_overlap.detail}`,
    `3. Plain style: ${results.req3_plain_style.pass ? "PASS" : "FAIL"} — ${results.req3_plain_style.detail}`,
  ];
  fs.writeFileSync(txtPath, lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  if (results.status !== "PASS") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
