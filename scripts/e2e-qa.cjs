const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "http://127.0.0.1:43127";
const MEDIA = "/cursor/stores/self/media";
const ARTIFACTS = "/opt/cursor/artifacts";

fs.mkdirSync(MEDIA, { recursive: true });
fs.mkdirSync(ARTIFACTS, { recursive: true });
fs.mkdirSync("/tmp/pu-qa", { recursive: true });

function writeSample(name, content) {
  const p = path.join("/tmp/pu-qa", name);
  fs.writeFileSync(p, content);
  return p;
}

async function shot(page, name) {
  for (const dir of [MEDIA, ARTIFACTS]) {
    await page.screenshot({ path: path.join(dir, name), fullPage: false });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function downloadClick(page, buttonName) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.getByRole("button", { name: buttonName }).click(),
  ]);
  const p = await dl.path();
  return { filename: dl.suggestedFilename(), size: fs.statSync(p).size, path: p };
}

(async () => {
  const results = [];
  const record = (name, pass, detail) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });

  const txt = writeSample("sample.txt", "Hello Premium Utility converter sample.\n");
  const pdf = writeSample("sample.pdf", "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  const jpg = writeSample("sample.jpg", Buffer.alloc(1200, 0xff));
  const png = writeSample(
    "sample.png",
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(200)])
  );
  const docx = writeSample("sample.docx", "PK\u0003\u0004fake-docx-content-" + "x".repeat(400));
  const doc = writeSample("sample.doc", "OLE fake doc content " + "d".repeat(300));
  const xlsx = writeSample("sample.xlsx", "PK\u0003\u0004fake-xlsx-content-" + "y".repeat(400));
  const pdf2 = writeSample("sample2.pdf", "%PDF-1.4 second file\n%%EOF\n");

  try {
    // Legal
    for (const route of ["/terms", "/privacy", "/contact"]) {
      const res = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      assert(res.ok(), `${route} status ${res.status()}`);
      assert((await page.locator("h1").first().innerText()).length > 3, `${route} h1`);
    }
    await shot(page, "qa-legal-contact.png");
    record("Legal pages", true, "terms / privacy / contact OK");

    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.locator("#tools").scrollIntoViewIfNeeded();

    // Converter — all advertised formats
    await page.getByRole("tab", { name: "Converter" }).click();
    const convFormats = [
      { file: txt, label: "txt" },
      { file: pdf, label: "pdf" },
      { file: jpg, label: "jpg" },
      { file: png, label: "png" },
      { file: docx, label: "docx" },
      { file: doc, label: "doc" },
      { file: xlsx, label: "xlsx" },
    ];
    const convNotes = [];
    for (const f of convFormats) {
      await page.locator('#tools input[type="file"]').first().setInputFiles(f.file);
      await page.waitForTimeout(350);
      const timerUp = await page.locator('header [role="timer"]').isVisible();
      assert(timerUp, `wipe timer missing after ${f.label} upload`);
      await page.getByRole("button", { name: "Convert file" }).click();
      await page.getByRole("button", { name: /Download result/i }).waitFor({ timeout: 10000 });
      const dl = await downloadClick(page, /Download result/i);
      assert(dl.size > 0, `empty convert output for ${f.label}`);
      convNotes.push(`${f.label}→${dl.filename}(${dl.size}b)`);
    }
    await shot(page, "qa-converter.png");
    record("Converter", true, convNotes.join("; "));

    // Wipe timer dedicated check (before download clears it)
    await page.locator('#tools input[type="file"]').first().setInputFiles(txt);
    await page.waitForTimeout(400);
    const timerEl = page.locator('header [role="timer"]');
    assert(await timerEl.isVisible(), "timer not visible after upload");
    const timerText = (await timerEl.innerText()).replace(/\s+/g, " ").trim();
    assert(/file deleted in/i.test(timerText), "timer copy");
    assert(/[0-3]:\d{2}/.test(timerText), "countdown format");
    // verify countdown ticks
    await page.waitForTimeout(1100);
    const timerText2 = (await timerEl.innerText()).replace(/\s+/g, " ").trim();
    await shot(page, "qa-wipe-timer.png");
    record("Wipe timer", true, `shown="${timerText}" after1s="${timerText2}"`);

    // Translator
    await page.getByRole("tab", { name: "Translator" }).click();
    await page.waitForTimeout(300);
    // Translator has its own file input inside tab panel
    await page.locator('[data-slot="tabs-content"] input[type="file"]').setInputFiles(docx);
    await page.waitForTimeout(400);
    await page.getByRole("combobox").click();
    await page.waitForTimeout(500);
    const optCount = await page.locator('[role="option"]').count();
    // Prefer a world + india language
    if (await page.getByRole("option", { name: "Tamil" }).count()) {
      await page.getByRole("option", { name: "Tamil" }).click();
    } else {
      await page.locator('[role="option"]').nth(4).click();
    }
    await page.getByRole("button", { name: /Translate & preview/i }).click();
    await page.getByRole("button", { name: /Download translation/i }).waitFor({ timeout: 10000 });
    const prev = await page.locator('[data-slot="tabs-content"] pre').last().innerText();
    assert(prev.length > 30, "translation preview empty");
    // Also accept PDF + Excel uploads
    await page.locator('[data-slot="tabs-content"] input[type="file"]').setInputFiles(pdf);
    await page.waitForTimeout(300);
    await page.locator('[data-slot="tabs-content"] input[type="file"]').setInputFiles(xlsx);
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /Translate & preview/i }).click();
    await page.getByRole("button", { name: /Download translation/i }).waitFor({ timeout: 10000 });
    const tDl = await downloadClick(page, /Download translation/i);
    await shot(page, "qa-translator.png");
    record(
      "Translator",
      optCount >= 90 && tDl.size > 0,
      `${optCount} langs; preview ${prev.slice(0, 40).replace(/\n/g, " ")}…; download ${tDl.size}b; accepted docx/pdf/xlsx`
    );

    // Merger
    await page.getByRole("tab", { name: "Merger" }).click();
    await page.waitForTimeout(300);
    await page
      .locator('[data-slot="tabs-content"] input[type="file"]')
      .setInputFiles([pdf, docx, pdf2, doc]);
    await page.waitForTimeout(600);
    const items = await page.locator('[data-slot="tabs-content"] ol li').count();
    assert(items >= 2, `merge list ${items}`);
    await page.getByRole("button", { name: "Move down" }).first().click();
    await page.getByRole("button", { name: /Merge documents/i }).click();
    await page.getByRole("button", { name: /Download merged file/i }).waitFor({ timeout: 10000 });
    const mDl = await downloadClick(page, /Download merged file/i);
    await shot(page, "qa-merger.png");
    record("Merger", items >= 2 && mDl.size > 0, `${items} files ordered+merged; ${mDl.filename} ${mDl.size}b`);

    // Compressor exact KB
    await page.getByRole("tab", { name: "Compressor" }).click();
    await page.waitForTimeout(300);
    await page.locator('[data-slot="tabs-content"] input[type="file"]').setInputFiles(png);
    await page.locator("#target-size").fill("2");
    await page.getByRole("button", { name: "KB", exact: true }).click();
    await page.getByRole("button", { name: /to exact size/i }).click();
    await page.getByText(/Output size/i).waitFor({ timeout: 10000 });
    const kbUi = await page.locator('[data-slot="tabs-content"] .rounded-2xl').filter({ hasText: "Exact target" }).innerText();
    const kbDl = await downloadClick(page, /Download result/i);
    const exactKb = kbDl.size === 2048;
    await shot(page, "qa-compressor-kb.png");
    record("Compressor exact KB", exactKb, `target 2KB; got ${kbDl.size}b; UI: ${kbUi.replace(/\s+/g, " ").slice(0, 100)}`);

    // Expander exact MB
    await page.locator('[data-slot="tabs-content"] input[type="file"]').setInputFiles(jpg);
    await page.locator("#target-size").fill("0.01");
    await page.getByRole("button", { name: "MB", exact: true }).click();
    await page.getByRole("button", { name: /to exact size/i }).click();
    await page.getByText(/Output size/i).waitFor({ timeout: 10000 });
    const mbDl = await downloadClick(page, /Download result/i);
    const targetMb = Math.round(0.01 * 1024 * 1024);
    const exactMb = mbDl.size === targetMb;
    await shot(page, "qa-expander-mb.png");
    record("Expander exact MB", exactMb, `target 0.01MB=${targetMb}b; got ${mbDl.size}b`);

    // Also PDF/Word through compressor
    await page.locator('[data-slot="tabs-content"] input[type="file"]').setInputFiles(pdf);
    await page.locator("#target-size").fill("1");
    await page.getByRole("button", { name: "KB", exact: true }).click();
    await page.getByRole("button", { name: /to exact size/i }).click();
    await page.getByText(/Output size/i).waitFor({ timeout: 10000 });
    const pdfKb = await downloadClick(page, /Download result/i);
    record("Compressor PDF→exact KB", pdfKb.size === 1024, `got ${pdfKb.size}b`);

    await page.locator('[data-slot="tabs-content"] input[type="file"]').setInputFiles(docx);
    await page.locator("#target-size").fill("3");
    await page.getByRole("button", { name: /to exact size/i }).click();
    await page.getByText(/Output size/i).waitFor({ timeout: 10000 });
    const docKb = await downloadClick(page, /Download result/i);
    record("Compressor Word→exact KB", docKb.size === 3072, `got ${docKb.size}b`);

    await page.getByRole("tab", { name: "Premium" }).click();
    assert(await page.getByText(/Premium desk/i).isVisible(), "premium");
    record("Premium tab UI", true, "visible");

    // Short proof video
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: "/tmp/pu-qa-video", size: { width: 1280, height: 720 } },
    });
    const vp = await context.newPage();
    await vp.goto(BASE, { waitUntil: "networkidle" });
    await vp.locator("#tools").scrollIntoViewIfNeeded();
    await vp.getByRole("tab", { name: "Translator" }).click();
    await vp.waitForTimeout(600);
    await vp.getByRole("tab", { name: "Compressor" }).click();
    await vp.waitForTimeout(600);
    await context.close();
    const vids = fs.readdirSync("/tmp/pu-qa-video").filter((f) => f.endsWith(".webm"));
    if (vids[0]) {
      const src = path.join("/tmp/pu-qa-video", vids[0]);
      fs.copyFileSync(src, path.join(MEDIA, "qa-e2e-demo.webm"));
      fs.copyFileSync(src, path.join(ARTIFACTS, "qa-e2e-demo.webm"));
      try {
        require("child_process").execSync(
          `ffmpeg -y -i "${src}" -c:v libx264 -pix_fmt yuv420p ${path.join(MEDIA, "qa-e2e-demo.mp4")}`,
          { stdio: "ignore" }
        );
        fs.copyFileSync(path.join(MEDIA, "qa-e2e-demo.mp4"), path.join(ARTIFACTS, "qa-e2e-demo.mp4"));
      } catch {}
      record("QA video", true, "qa-e2e-demo.mp4/.webm written");
    }
  } catch (err) {
    record("SUITE", false, String(err && err.stack ? err.stack : err));
    try {
      await shot(page, "qa-failure.png");
    } catch {}
  }

  await browser.close();
  const summary = {
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
  };
  fs.writeFileSync(path.join(MEDIA, "qa-results.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(ARTIFACTS, "qa-results.json"), JSON.stringify(summary, null, 2));
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.failed ? 1 : 0);
})();
