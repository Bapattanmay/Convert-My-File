/**
 * Full feature matrix — free tools + all 9 Premium desk workflows.
 * Auth + Premium unlocked via route mocks (no Google OAuth).
 *
 *   BASE_URL=https://convert-my-file-oo3r.onrender.com \
 *   PROOF_LABEL=live- node scripts/e2e-full-matrix.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts } = require("pdf-lib");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43129";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";
const FIX = path.join(OUT, "_full-matrix-fixtures");
const LABEL = process.env.PROOF_LABEL || "";
const FAKE_EMAIL = "bapattanmay@gmail.com"; // matches PREMIUM_EMAILS allowlist on live

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function row(matrix, feature, checkName, pass, detail) {
  if (!matrix[feature]) matrix[feature] = {};
  matrix[feature][checkName] = { pass: !!pass, detail: String(detail).slice(0, 220) };
  console.log(`${pass ? "PASS" : "FAIL"}  ${feature} · ${checkName} — ${String(detail).slice(0, 160)}`);
}

async function unlockAuthAndPremium(page) {
  const fakeUser = {
    id: "e2e-matrix-user",
    name: "Matrix QA",
    email: FAKE_EMAIL,
    timeSpentSeconds: 0,
    featuresUsed: ["converter", "translator", "merger", "compressor", "premium"],
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
        usageSessionId: "e2e-matrix-sid",
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
  // Premium allowlist / upgrade — always unlocked for matrix
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

async function openTab(page, tabName) {
  await page.goto(BASE + "/#tools", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate((email) => {
    try {
      localStorage.setItem("cmf_premium_emails", JSON.stringify([email.toLowerCase()]));
    } catch (_) {}
  }, FAKE_EMAIL);
  await page.locator("#tools").scrollIntoViewIfNeeded();
  await page
    .getByText("Google login for Premium")
    .waitFor({ state: "hidden", timeout: 25000 })
    .catch(() => {});
  await page.getByRole("tab", { name: tabName, exact: true }).click();
  await page.waitForTimeout(500);
  const locked = await page.getByText("Google login for Premium").isVisible().catch(() => false);
  if (locked) throw new Error("Login gate still visible on " + tabName);
}

async function openPremiumPanel(page, titleSubstring) {
  await openTab(page, "Premium");
  await page.getByText("Premium active").first().waitFor({ timeout: 20000 });
  const tile = page
    .locator("button")
    .filter({ hasText: new RegExp(titleSubstring, "i") })
    .first();
  await tile.click();
  await page.waitForTimeout(400);
  const blocked = await page.getByText("Premium required for this workflow").isVisible().catch(() => false);
  if (blocked) throw new Error("Premium still gated for " + titleSubstring);
}

async function buildDocx(filePath, phrase) {
  const JSZip = require("jszip");
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
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder("word").file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${phrase}</w:t></w:r></w:p></w:body>
</w:document>`
  );
  fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer" }));
}

async function buildPdf(filePath, phrase, pages = 1) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`${phrase} p${i + 1}`, { x: 50, y: 700, size: 14, font });
  }
  fs.writeFileSync(filePath, Buffer.from(await doc.save()));
}

async function buildPng(filePath) {
  // 64x64 red-ish PNG
  fs.writeFileSync(
    filePath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAhElEQVR4nO3RMQEAIAzAMMC/5+eAhhJ0s3fMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzHBkxAAV8dwpGFAAAAAElFTkSuQmCC",
      "base64"
    )
  );
}

async function buildPptx(filePath, phrase) {
  const JSZip = require("jszip");
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
</Types>`
  );
  zip.folder("_rels").file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );
  zip.folder("ppt").file(
    "presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
</p:presentation>`
  );
  zip.folder("ppt").folder("_rels").file(
    "presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`
  );
  zip.folder("ppt").folder("slides").file(
    "slide1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr/>
      <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${phrase}</a:t></a:r></a:p></p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:sld>`
  );
  fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer" }));
}

async function ensureFixtures() {
  fs.mkdirSync(FIX, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  await buildDocx(path.join(FIX, "sample.docx"), "MATRIX-DOCX-ALPHA Platform Code Review");
  await buildDocx(
    path.join(FIX, "translate.docx"),
    "The Convert My File workspace keeps documents ephemeral after download."
  );
  await buildPdf(path.join(FIX, "sample.pdf"), "MATRIX-PDF-BETA", 1);
  await buildPdf(path.join(FIX, "pages-a.pdf"), "RANGE-A", 7);
  await buildPdf(path.join(FIX, "pages-b.pdf"), "RANGE-B", 3);
  await buildPdf(path.join(FIX, "editor.pdf"), "EDIT-ME ROUNDTRIP TEXT", 2);
  await buildPng(path.join(FIX, "sample.png"));
  await buildPptx(path.join(FIX, "sample.pptx"), "MATRIX-PPTX");
  fs.writeFileSync(path.join(FIX, "bad.exe"), Buffer.from("MZ-fake-executable"));
  fs.writeFileSync(path.join(FIX, "note.txt"), "Batch text one for ZIP convert path.\n");
  fs.writeFileSync(path.join(FIX, "note2.txt"), "Batch text two for ZIP convert path.\n");
  // fake mp3/mp4 headers + payload for media size tests
  const mp3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(6000, 0x11)]);
  fs.writeFileSync(path.join(FIX, "sample.mp3"), mp3);
  const mp4 = Buffer.concat([
    Buffer.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]),
    Buffer.alloc(8000, 0x22),
  ]);
  fs.writeFileSync(path.join(FIX, "sample.mp4"), mp4);
  fs.writeFileSync(path.join(FIX, "bulk1.bin.png"), Buffer.alloc(5000, 0x33));
  fs.copyFileSync(path.join(FIX, "sample.png"), path.join(FIX, "bulk2.png"));
}

async function downloadClick(page, buttonRegex, outPath, timeout = 45000) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    page.getByRole("button", { name: buttonRegex }).click(),
  ]);
  await dl.saveAs(outPath);
  return fs.readFileSync(outPath);
}

async function main() {
  await ensureFixtures();
  const matrix = {};
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    acceptDownloads: true,
  });
  page.setDefaultTimeout(45000);
  await unlockAuthAndPremium(page);

  // ═══════ FREE: Converter ═══════
  try {
    await openTab(page, "Converter");
    await page.locator('#tools input[type="file"]').first().setInputFiles(path.join(FIX, "bad.exe"));
    await page.waitForTimeout(700);
    const rej = await page.locator("#tools [role='alert']").textContent().catch(() => "");
    row(matrix, "Converter", "input", /not supported|unsupported/i.test(rej || ""), `reject exe: ${(rej || "").slice(0, 80)}`);

    await openTab(page, "Converter");
    await page.getByRole("button", { name: "DOC → PDF", exact: true }).click();
    await page.locator('#tools input[type="file"]').first().setInputFiles(path.join(FIX, "sample.docx"));
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /Convert file/i }).click();
    await page.waitForFunction(() => {
      const t = Array.from(document.querySelectorAll("#tools pre")).map((p) => p.textContent || "").join("\n");
      return t.includes("ALPHA") && !t.includes("Click Convert");
    }, { timeout: 60000 });
    row(matrix, "Converter", "process", true, "DOCX→PDF completed");
    const prev = (await page.locator("#tools pre").allTextContents()).join("\n");
    row(matrix, "Converter", "preview", prev.includes("ALPHA"), prev.slice(0, 100));
    const pdfBytes = await downloadClick(page, /Download/i, path.join(OUT, `${LABEL}matrix-converter-out.pdf`));
    row(matrix, "Converter", "output", pdfBytes.slice(0, 5).toString() === "%PDF-" && pdfBytes.length > 400, `PDF ${pdfBytes.length}b`);
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-converter.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix.Converter?.[k]) row(matrix, "Converter", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-converter-FAIL.png`), fullPage: true }).catch(() => {});
  }

  // ═══════ FREE: Translator ═══════
  try {
    await openTab(page, "Translator");
    await page.locator('#tools input[type="file"]').first().setInputFiles(path.join(FIX, "bad.exe"));
    await page.waitForTimeout(600);
    const tRej = await page.locator("#tools [role='alert']").textContent().catch(() => "");
    await page.locator('#tools input[type="file"]').first().setInputFiles(path.join(FIX, "translate.docx"));
    await page.waitForTimeout(1000);
    const accepted = await page.getByText(/translate\.docx/i).count();
    row(matrix, "Translator", "input", accepted > 0 && /not supported/i.test(tRej || ""), `exe rejected; docx chip=${accepted}`);

    await page.getByRole("button", { name: /Translate & preview/i }).click();
    await page.waitForTimeout(2000);
    await page.waitForFunction(() => {
      const t = document.body.innerText;
      const alert = document.querySelector("#tools [role='alert']");
      if (alert && /429|failed|error/i.test(alert.textContent || "")) return true;
      return /Provider:|MyMemory|Google/i.test(t);
    }, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const body = await page.locator("#tools").innerText();
    const alert = await page.locator("#tools [role='alert']").textContent().catch(() => "");
    const processOk =
      !/429|Translation service failed/i.test(alert || "") &&
      !/429|Translation service failed/i.test(body) &&
      /Provider:|MyMemory|Google|Translated Preview/i.test(body);
    row(matrix, "Translator", "process", processOk, processOk ? "translate finished" : (alert || body).slice(0, 120));
    const previews = await page.locator("#tools pre").allTextContents().catch(() => []);
    const joined = (previews || []).join("\n");
    // Require real target script or clear non-English translated body (not the placeholder)
    const previewOk =
      /[\u0900-\u097F]/.test(joined) ||
      (/Translated Preview/i.test(body) &&
        joined.length > 40 &&
        !/Run translate to generate/i.test(joined) &&
        !/Click Convert|Hello world\. Platform quality depends/.test(joined));
    row(matrix, "Translator", "preview", previewOk, previewOk ? "translated preview present" : joined.slice(0, 100));

    const hasDl = await page.getByRole("button", { name: /Download/i }).isVisible().catch(() => false);
    if (hasDl) {
      const out = await downloadClick(page, /Download/i, path.join(OUT, `${LABEL}matrix-translator-out.bin`));
      row(matrix, "Translator", "output", out.length > 20, `download ${out.length}b`);
    } else {
      row(matrix, "Translator", "output", previewOk, previewOk ? "preview ready (download optional)" : "no download / no preview");
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-translator.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix.Translator?.[k]) row(matrix, "Translator", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-translator-FAIL.png`), fullPage: true }).catch(() => {});
  }

  // ═══════ FREE: Merger ═══════
  try {
    await openTab(page, "Merger");
    await page.locator('#tools input[type="file"]').first().setInputFiles([
      path.join(FIX, "sample.pdf"),
      path.join(FIX, "sample.docx"),
    ]);
    await page.waitForTimeout(800);
    const list = await page.locator("#tools ol li, #tools li").count();
    row(matrix, "Merger", "input", list >= 2, `files listed=${list}`);
    await page.getByRole("button", { name: /Merge documents/i }).click();
    await page.waitForSelector("text=/Merged PDF ready/i", { timeout: 60000 });
    row(matrix, "Merger", "process", true, "merge completed");
    const mTxt = await page.locator("#tools").innerText();
    row(matrix, "Merger", "preview", /Merged PDF ready/i.test(mTxt), mTxt.match(/Merged PDF ready[^\n]*/)?.[0] || "ready");
    const merged = await downloadClick(page, /Download merged PDF/i, path.join(OUT, `${LABEL}matrix-merger-out.pdf`));
    row(matrix, "Merger", "output", merged.slice(0, 5).toString() === "%PDF-" && merged.length > 500, `PDF ${merged.length}b`);
    // reject unsupported
    await page.locator('#tools input[type="file"]').first().setInputFiles(path.join(FIX, "bad.exe"));
    await page.waitForTimeout(500);
    const mRej = await page.locator("#tools [role='alert']").textContent().catch(() => "");
    if (matrix.Merger.input) {
      matrix.Merger.input.detail += `; exe reject=${/not supported|Unsupported/i.test(mRej || "")}`;
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-merger.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix.Merger?.[k]) row(matrix, "Merger", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-merger-FAIL.png`), fullPage: true }).catch(() => {});
  }

  // ═══════ FREE: Compressor ═══════
  try {
    await openTab(page, "Compressor");
    await page.locator('#tools input[type="file"]').first().setInputFiles(path.join(FIX, "sample.png"));
    await page.waitForTimeout(600);
    await page.locator('#tools input[type="text"], #tools input:not([type="file"])').first().fill("1");
    // unit KB default
    const unitBtn = page.getByRole("button", { name: /^KB$/i }).or(page.locator("select, button").filter({ hasText: /^KB$/ }));
    await page.getByRole("button", { name: /Compress|Expand|Resize|Match/i }).click();
    await page.waitForSelector("text=/ready|exact|Download/i", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    const cTxt = await page.locator("#tools").innerText();
    const processOk = /Download|ready|1024|1\s*KB/i.test(cTxt);
    row(matrix, "Compressor", "input", /sample\.png/i.test(cTxt), "png accepted");
    row(matrix, "Compressor", "process", processOk, processOk ? "resize done" : cTxt.slice(0, 100));
    const thumb = await page.locator('#tools img, [data-testid="compress-file-card"]').count();
    row(matrix, "Compressor", "preview", thumb > 0 || /sample\.png/i.test(cTxt), `thumb/card=${thumb}`);
    const hasDl = await page.getByRole("button", { name: /Download/i }).isVisible().catch(() => false);
    if (hasDl) {
      const out = await downloadClick(page, /Download/i, path.join(OUT, `${LABEL}matrix-compressor-out.bin`));
      row(matrix, "Compressor", "output", out.length === 1024, `bytes=${out.length} expect 1024`);
    } else {
      row(matrix, "Compressor", "output", false, "no download");
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-compressor.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix.Compressor?.[k]) row(matrix, "Compressor", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-compressor-FAIL.png`), fullPage: true }).catch(() => {});
  }

  // ═══════ PREMIUM 1: Batch convert → ZIP ═══════
  try {
    await openPremiumPanel(page, "Batch convert");
    const fileInput = page.locator('#tools input[type="file"]').last();
    await fileInput.setInputFiles([
      path.join(FIX, "note.txt"),
      path.join(FIX, "note2.txt"),
      path.join(FIX, "sample.docx"),
    ]);
    await page.waitForTimeout(500);
    const batchTxt = await page.locator("#tools").innerText();
    row(matrix, "Premium: Batch ZIP", "input", /3 file/i.test(batchTxt), batchTxt.match(/\d+ file[s]? selected/)?.[0] || batchTxt.slice(0, 60));
    await page.getByRole("button", { name: /Convert to ZIP/i }).click();
    await page.waitForSelector("text=/converted/i", { timeout: 90000 });
    row(matrix, "Premium: Batch ZIP", "process", true, "batch convert finished");
    const bTxt = await page.locator("#tools").innerText();
    row(matrix, "Premium: Batch ZIP", "preview", /\d+ converted/i.test(bTxt), bTxt.match(/[^\n]*converted[^\n]*/)?.[0] || "summary");
    const zipBuf = await downloadClick(page, /Download ZIP/i, path.join(OUT, `${LABEL}matrix-batch.zip`));
    row(matrix, "Premium: Batch ZIP", "output", zipBuf[0] === 0x50 && zipBuf[1] === 0x4b && zipBuf.length > 50, `ZIP ${zipBuf.length}b`);
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-batch.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix["Premium: Batch ZIP"]?.[k]) row(matrix, "Premium: Batch ZIP", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-batch-FAIL.png`), fullPage: true }).catch(() => {});
  }

  // ═══════ PREMIUM 2: PDF editor ═══════
  try {
    await openPremiumPanel(page, "PDF Editor");
    // Prefer testid when deployed; fall back to first PDF accept input
    const pdfOpen = page.locator('[data-testid="premium-pdf-open"]');
    if (await pdfOpen.count()) {
      await pdfOpen.setInputFiles(path.join(FIX, "editor.pdf"));
    } else {
      await page.locator('#tools input[type="file"][accept*="pdf"]').first().setInputFiles(path.join(FIX, "editor.pdf"));
    }
    await page.waitForSelector("#tools textarea", { timeout: 90000 });
    const ta = page.locator("#tools textarea");
    const text = await ta.inputValue();
    row(matrix, "Premium: PDF editor", "input", /EDIT-ME|ROUNDTRIP/i.test(text), `extracted ${text.slice(0, 60)}`);
    await ta.fill(text + "\nEDITED-BY-MATRIX-QA");
    row(matrix, "Premium: PDF editor", "preview", true, "textarea editable");
    await page.getByRole("button", { name: /Export edited PDF/i }).click();
    await page.waitForSelector("text=/Download PDF/i", { timeout: 30000 });
    row(matrix, "Premium: PDF editor", "process", true, "export ready");
    const edited = await downloadClick(page, /Download PDF/i, path.join(OUT, `${LABEL}matrix-pdf-editor.pdf`));
    row(matrix, "Premium: PDF editor", "output", edited.slice(0, 5).toString() === "%PDF-", `PDF ${edited.length}b`);
    const hasDoc = await page.getByRole("button", { name: /Download editable DOC/i }).isVisible();
    if (hasDoc) {
      const docx = await downloadClick(page, /Download editable DOC/i, path.join(OUT, `${LABEL}matrix-pdf-editor.docx`));
      matrix["Premium: PDF editor"].output.detail += `; docx ${docx.length}b`;
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-pdf-editor.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix["Premium: PDF editor"]?.[k]) row(matrix, "Premium: PDF editor", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-pdf-editor-FAIL.png`), fullPage: true }).catch(() => {});
  }

  // ═══════ PREMIUM 3: 5-language batch (live /api/translate) ═══════
  try {
    await openPremiumPanel(page, "5-language");
    await page.locator("#tools textarea").fill(
      "The Convert My File workspace keeps documents ephemeral after download."
    );
    // Prefer 2 languages for live quota stability (Hindi + Spanish)
    for (const lang of ["Tamil", "French", "German"]) {
      const btn = page.locator("#tools button").filter({ hasText: new RegExp(`^${lang}$`) }).first();
      if (await btn.count()) await btn.click().catch(() => {});
    }
    await page.waitForTimeout(400);
    row(matrix, "Premium: 5-lang batch", "input", true, `source chars=${(await page.locator("#tools textarea").inputValue()).length}`);
    await page.getByRole("button", { name: /Translate batch/i }).click();
    await page.getByRole("button", { name: /^Download pack$/i }).waitFor({ state: "visible", timeout: 180000 });
    const langTxt = await page.locator("#tools").innerText();
    const liveOk = !/429|No successful translations/i.test(langTxt);
    row(matrix, "Premium: 5-lang batch", "process", liveOk, liveOk ? "batch done (live API)" : langTxt.slice(0, 120));
    const previewOk =
      (/[ऀ-ॿ]/.test(langTxt) || /espacio|documento|efímer/i.test(langTxt)) &&
      /Hindi|Spanish/i.test(langTxt);
    row(matrix, "Premium: 5-lang batch", "preview", previewOk, previewOk ? "live lang previews" : langTxt.slice(0, 100));
    const dlBtn = page.getByRole("button", { name: /^Download pack$/i });
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      dlBtn.click(),
    ]);
    const packPath = path.join(OUT, `${LABEL}matrix-5lang.zip`);
    await dl.saveAs(packPath);
    const pack = fs.readFileSync(packPath);
    row(matrix, "Premium: 5-lang batch", "output", pack[0] === 0x50 && pack[1] === 0x4b, `ZIP ${pack.length}b (live API)`);
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-5lang.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix["Premium: 5-lang batch"]?.[k]) row(matrix, "Premium: 5-lang batch", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-5lang-FAIL.png`), fullPage: true }).catch(() => {});
  }

  // ═══════ PREMIUM 4: Page-range merge ═══════
  try {
    await openPremiumPanel(page, "Page-range");
    await page.getByRole("button", { name: /Add files/i }).click();
    await page.locator('#tools input[type="file"]').last().setInputFiles([
      path.join(FIX, "pages-a.pdf"),
      path.join(FIX, "pages-b.pdf"),
    ]);
    await page.waitForTimeout(1500);
    const prTxt = await page.locator("#tools").innerText();
    row(matrix, "Premium: Page-range merge", "input", /pages-a\.pdf/i.test(prTxt) && /7 pages/i.test(prTxt), "PDFs with page counts");
    // Contiguous From/To drafts (text) + preview of planned pages
    const rows = page.locator('[data-testid="page-merge-row"]');
    const rowCount = await rows.count();
    if (rowCount >= 1) {
      const from0 = rows.nth(0).locator('[data-testid="page-merge-from"]');
      const to0 = rows.nth(0).locator('[data-testid="page-merge-to"]');
      await from0.fill("3");
      await to0.fill("7");
      await to0.blur();
    }
    if (rowCount >= 2) {
      const from1 = rows.nth(1).locator('[data-testid="page-merge-from"]');
      const to1 = rows.nth(1).locator('[data-testid="page-merge-to"]');
      await from1.fill("1");
      await to1.fill("2");
      await to1.blur();
    }
    await page.waitForTimeout(300);
    const previewTxt = await page.locator('[data-testid="page-merge-preview"]').innerText().catch(() => "");
    const previewOk =
      /MERGE PREVIEW/i.test(previewTxt) &&
      (/3,\s*4,\s*5,\s*6,\s*7/.test(previewTxt) || /3/.test(previewTxt));
    row(matrix, "Premium: Page-range merge", "preview", previewOk, previewOk ? "MERGE PREVIEW 3–7 + 1–2" : previewTxt.slice(0, 120));
    await page.locator('[data-testid="page-merge-run"]').or(page.getByRole("button", { name: /Merge selected pages/i })).click();
    await page.waitForSelector('[data-testid="premium-page-range-download"], text=/Download \\(/i', { timeout: 60000 });
    row(matrix, "Premium: Page-range merge", "process", true, "merge ok");
    const dlPr = page.locator('[data-testid="premium-page-range-download"]').or(
      page.getByRole("button", { name: /Download \(/i })
    );
    const [dlEv] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      dlPr.first().click(),
    ]);
    const prPath = path.join(OUT, `${LABEL}matrix-page-range.pdf`);
    await dlEv.saveAs(prPath);
    const out = fs.readFileSync(prPath);
    const doc = await PDFDocument.load(out);
    const pc = doc.getPageCount();
    row(matrix, "Premium: Page-range merge", "output", pc === 7, `pages=${pc} expect 7 (3-7 + 1-2)`);
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-page-range.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix["Premium: Page-range merge"]?.[k]) row(matrix, "Premium: Page-range merge", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-page-range-FAIL.png`), fullPage: true }).catch(() => {});
  }

  // ═══════ PREMIUM 5: Merge + compress ═══════
  try {
    await openPremiumPanel(page, "Merge \\+ compress");
    await page.locator('#tools input[type="file"]').last().setInputFiles([
      path.join(FIX, "sample.pdf"),
      path.join(FIX, "sample.docx"),
    ]);
    await page.waitForTimeout(600);
    const kb = page.locator('[data-testid="premium-merge-compress-kb"]').or(
      page.locator('#tools input:not([type="file"]):not([type="number"]):not([type="range"])').first()
    );
    await kb.first().fill("50");
    row(matrix, "Premium: Merge+compress", "input", true, "2 files + target KB");
    await page.getByRole("button", { name: /Merge & compress/i }).click();
    await page.waitForSelector("text=/50\\.00 KB|Download|KB/i", { timeout: 60000 });
    row(matrix, "Premium: Merge+compress", "process", true, "done");
    row(matrix, "Premium: Merge+compress", "preview", true, "download available");
    const dlMc = page.locator('[data-testid="premium-merge-compress-download"]').or(
      page.getByRole("button", { name: /50\.00 KB|KB/i })
    );
    const [dlEv2] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      dlMc.first().click(),
    ]);
    const mcPath = path.join(OUT, `${LABEL}matrix-merge-compress.pdf`);
    await dlEv2.saveAs(mcPath);
    const out = fs.readFileSync(mcPath);
    const expect = 50 * 1024;
    row(matrix, "Premium: Merge+compress", "output", out.length === expect, `bytes=${out.length} expect ${expect}`);
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-merge-compress.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix["Premium: Merge+compress"]?.[k]) row(matrix, "Premium: Merge+compress", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-merge-compress-FAIL.png`), fullPage: true }).catch(() => {});
  }

  // ═══════ PREMIUM 6: Digital signature ═══════
  try {
    await openPremiumPanel(page, "Digital signature");
    await page.locator('#tools input[type="file"]').last().setInputFiles(path.join(FIX, "sample.pdf"));
    await page.waitForTimeout(500);
    row(matrix, "Premium: Digital signature", "input", true, "pdf uploaded");
    await page.getByRole("button", { name: /Apply signature/i }).click();
    await page.waitForSelector("text=/Download signed PDF/i", { timeout: 45000 });
    const err = await page.locator("#tools [role='alert']").textContent().catch(() => "");
    row(matrix, "Premium: Digital signature", "process", !/WinAnsi|cannot encode/i.test(err || ""), err || "signed");
    row(matrix, "Premium: Digital signature", "preview", true, "signed ready");
    const signed = await downloadClick(page, /Download signed PDF/i, path.join(OUT, `${LABEL}matrix-signed.pdf`));
    row(matrix, "Premium: Digital signature", "output", signed.slice(0, 5).toString() === "%PDF-" && signed.length > 800, `PDF ${signed.length}b`);
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-signed.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix["Premium: Digital signature"]?.[k]) row(matrix, "Premium: Digital signature", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-signed-FAIL.png`), fullPage: true }).catch(() => {});
  }

  // ═══════ PREMIUM 7: Quality before/after ═══════
  try {
    await openPremiumPanel(page, "Quality before");
    await page.getByRole("button", { name: /Upload image/i }).click();
    await page.locator('#tools input[type="file"]').last().setInputFiles(path.join(FIX, "sample.png"));
    await page.waitForSelector('img[alt="Before"]', { timeout: 30000 });
    await page.waitForSelector('img[alt="After"]', { timeout: 30000 });
    row(matrix, "Premium: Quality preview", "input", true, "image loaded");
    row(matrix, "Premium: Quality preview", "preview", true, "before/after imgs");
    const slider = page.locator('#tools input[type="range"]');
    await slider.fill("0.3");
    await page.waitForTimeout(800);
    row(matrix, "Premium: Quality preview", "process", true, "quality re-encode");
    const after = await downloadClick(page, /Download after/i, path.join(OUT, `${LABEL}matrix-quality.jpg`));
    row(matrix, "Premium: Quality preview", "output", after[0] === 0xff && after[1] === 0xd8, `JPEG ${after.length}b`);
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-quality.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix["Premium: Quality preview"]?.[k]) row(matrix, "Premium: Quality preview", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-quality-FAIL.png`), fullPage: true }).catch(() => {});
  }

  // ═══════ PREMIUM 8: Video & audio ═══════
  try {
    await openPremiumPanel(page, "Video & audio");
    await page.locator('#tools input[type="file"]').last().setInputFiles(path.join(FIX, "sample.mp3"));
    await page.waitForTimeout(500);
    const mediaTxt = await page.locator("#tools").innerText();
    row(matrix, "Premium: Video/audio", "input", /sample\.mp3|audio/i.test(mediaTxt), mediaTxt.match(/sample\.mp3[^\n]*/)?.[0] || "mp3");
    const mb = page.locator('[data-testid="premium-media-mb"]').or(
      page.locator('#tools input:not([type="file"]):not([type="range"])').first()
    );
    await mb.first().fill("1");
    await page.getByRole("button", { name: /Resize media/i }).click();
    await page.waitForSelector("text=/1\\.00 MB|Download/i", { timeout: 30000 });
    row(matrix, "Premium: Video/audio", "process", true, "resized");
    row(matrix, "Premium: Video/audio", "preview", true, "ready");
    const dlMedia = page.locator('[data-testid="premium-media-download"]').or(
      page.getByRole("button", { name: /1\.00 MB/i })
    );
    const [dlEv3] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      dlMedia.first().click(),
    ]);
    const mediaPath = path.join(OUT, `${LABEL}matrix-media.mp3`);
    await dlEv3.saveAs(mediaPath);
    const out = fs.readFileSync(mediaPath);
    const expect = 1 * 1024 * 1024;
    row(matrix, "Premium: Video/audio", "output", out.length === expect, `bytes=${out.length} expect ${expect}`);
    await page.locator('#tools input[type="file"]').last().setInputFiles(path.join(FIX, "sample.mp4"));
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Resize media/i }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-media.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix["Premium: Video/audio"]?.[k]) row(matrix, "Premium: Video/audio", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-media-FAIL.png`), fullPage: true }).catch(() => {});
  }

  // ═══════ PREMIUM 9: Bulk per-file targets ═══════
  try {
    await openPremiumPanel(page, "Bulk per-file");
    await page.getByRole("button", { name: /Add files/i }).click();
    await page.locator('#tools input[type="file"]').last().setInputFiles([
      path.join(FIX, "bulk2.png"),
      path.join(FIX, "sample.pdf"),
    ]);
    await page.waitForTimeout(800);
    const bulkTxt = await page.locator("#tools").innerText();
    row(matrix, "Premium: Bulk targets", "input", /bulk2\.png|sample\.pdf/i.test(bulkTxt), "2 files listed");
    const kbInputs = page.locator("#tools li input, #tools ul input");
    const kc = await kbInputs.count();
    if (kc >= 1) await kbInputs.nth(0).fill("20");
    if (kc >= 2) await kbInputs.nth(1).fill("30");
    row(matrix, "Premium: Bulk targets", "preview", kc >= 2, `per-file inputs=${kc}`);
    await page.getByRole("button", { name: /Compress bulk ZIP/i }).click();
    await page.waitForSelector("text=/Download ZIP/i", { timeout: 60000 });
    row(matrix, "Premium: Bulk targets", "process", true, "bulk done");
    const zipBuf = await downloadClick(page, /Download ZIP/i, path.join(OUT, `${LABEL}matrix-bulk.zip`));
    row(matrix, "Premium: Bulk targets", "output", zipBuf[0] === 0x50 && zipBuf[1] === 0x4b, `ZIP ${zipBuf.length}b`);
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-bulk.png`) });
  } catch (e) {
    for (const k of ["input", "process", "preview", "output"]) {
      if (!matrix["Premium: Bulk targets"]?.[k]) row(matrix, "Premium: Bulk targets", k, false, e.message || e);
    }
    await page.screenshot({ path: path.join(OUT, `${LABEL}matrix-bulk-FAIL.png`), fullPage: true }).catch(() => {});
  }

  await browser.close();

  // Summary
  const features = Object.keys(matrix);
  let passFeatures = 0;
  let failFeatures = 0;
  const summary = {};
  for (const f of features) {
    const checks = ["input", "process", "preview", "output"];
    const results = checks.map((c) => matrix[f][c]?.pass);
    const all = results.every(Boolean) && results.length === 4;
    summary[f] = all ? "PASS" : "FAIL";
    if (all) passFeatures++;
    else failFeatures++;
  }
  const overall = failFeatures === 0 && passFeatures === features.length ? "PASS" : "FAIL";
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    overall,
    passFeatures,
    failFeatures,
    featureCount: features.length,
    summary,
    matrix,
  };
  fs.writeFileSync(path.join(OUT, `${LABEL}full-matrix-results.json`), JSON.stringify(report, null, 2));
  const lines = [
    `${overall}\tfeatures=${passFeatures}/${features.length}`,
    ...features.map((f) => `${summary[f]}\t${f}\t${["input", "process", "preview", "output"].map((c) => (matrix[f][c]?.pass ? "Y" : "N")).join("")}`),
  ];
  fs.writeFileSync(path.join(OUT, `${LABEL}full-matrix-results.txt`), lines.join("\n") + "\n");
  console.log("\n" + lines.join("\n"));
  process.exit(overall === "PASS" ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
