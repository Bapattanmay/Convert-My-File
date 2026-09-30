/**
 * Translator Hindi e2e + Converter chip-state proof.
 * Mocks Google session so the login gate unlocks.
 *
 *   BASE_URL=http://127.0.0.1:43127 node scripts/e2e-translator-hindi.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43127";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";
const FIX = path.join(OUT, "_converter-fixtures");
const LABEL = process.env.PROOF_LABEL || "";

function assert(cond, msg, results) {
  if (!cond) throw new Error(msg);
  results.push("PASS: " + msg);
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
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder("word").file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${phrase}</w:t></w:r></w:p>
  </w:body>
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
    featuresUsed: ["translator", "converter"],
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
      body: JSON.stringify({ ok: true, featuresUsed: ["translator"] }),
    })
  );
}

async function main() {
  fs.mkdirSync(FIX, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const docxPath = path.join(FIX, "translate-sample.docx");
  await buildDocx(
    docxPath,
    "Platform Code Review is essential for software quality and team learning."
  );

  const results = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await unlockAuth(page);

  try {
    // --- Hindi translation ---
    await page.goto(BASE + "/#tools", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator("#tools").scrollIntoViewIfNeeded();
    await page
      .getByText("Google login for Premium")
      .waitFor({ state: "hidden", timeout: 20000 })
      .catch(() => {});
    await page.getByRole("tab", { name: "Translator" }).click();
    await page.waitForTimeout(400);

    await page.locator('#tools input[type="file"]').first().setInputFiles(docxPath);
    await page.waitForTimeout(800);
    // Language defaults to Hindi
    await page.getByRole("button", { name: /Translate & preview/i }).click();

    await page.waitForFunction(
      () => {
        const alert = document.querySelector("#tools [role='alert']");
        if (alert?.textContent?.trim()) return "ERR:" + alert.textContent;
        const text = Array.from(document.querySelectorAll("#tools pre"))
          .map((p) => p.textContent || "")
          .join("\n");
        if (/⟦|⟧|\[\[/.test(text)) return "ERR:stub brackets still present";
        // Devanagari block
        if (/[\u0900-\u097F]{3,}/.test(text)) return "OK";
        return false;
      },
      { timeout: 90000 }
    );

    const allPre = (await page.locator("#tools pre").allTextContents()).join("\n");
    if (allPre.includes("ERR:")) throw new Error(allPre);
    assert(/[\u0900-\u097F]{3,}/.test(allPre), "Hindi preview has Devanagari", results);
    assert(!/⟦|⟧/.test(allPre), "Hindi preview has no stub brackets", results);

    const hindiShot = path.join(OUT, `${LABEL}translator-hindi-preview.png`);
    await page.screenshot({ path: hindiShot, fullPage: false });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      page.getByRole("button", { name: /Download translation/i }).click(),
    ]);
    const outTxt = path.join(OUT, `${LABEL}translator-hindi-out.txt`);
    await download.saveAs(outTxt);
    const dl = fs.readFileSync(outTxt, "utf8");
    assert(/[\u0900-\u097F]{3,}/.test(dl), "Hindi download has Devanagari", results);
    assert(!/⟦|⟧/.test(dl), "Hindi download has no stub brackets", results);

    // --- Converter chip state (DOCX → only valid formats selectable) ---
    await page.getByRole("tab", { name: "Converter" }).click();
    await page.waitForTimeout(300);
    const sampleDocx = path.join(FIX, "sample.docx");
    if (!fs.existsSync(sampleDocx)) {
      await buildDocx(sampleDocx, "DOCX chip matrix probe ALPHA-90210");
    }
    await page.locator('#tools input[type="file"]').first().setInputFiles(sampleDocx);
    await page.waitForTimeout(700);

    const chips = page.locator('[data-testid="output-formats"] button');
    const count = await chips.count();
    assert(count >= 8, `output format chips rendered (${count})`, results);

    const allowed = [];
    const blocked = [];
    for (let i = 0; i < count; i++) {
      const chip = chips.nth(i);
      const label = (await chip.innerText()).trim().toLowerCase();
      const isAllowed = (await chip.getAttribute("data-allowed")) === "true";
      const disabled = await chip.isDisabled();
      const cls = (await chip.getAttribute("class")) || "";
      if (isAllowed) {
        allowed.push(label);
        assert(!disabled, `chip ${label} enabled`, results);
        assert(
          !cls.includes("opacity-55") && !cls.includes("opacity-40") && !cls.includes("line-through"),
          `chip ${label} not grayed`,
          results
        );
      } else {
        blocked.push(label);
        assert(disabled, `chip ${label} disabled`, results);
        assert(
          cls.includes("opacity-55") || cls.includes("opacity-40") || cls.includes("line-through"),
          `chip ${label} grayed`,
          results
        );
      }
    }
    assert(allowed.includes("pdf"), "DOCX allows PDF", results);
    assert(allowed.includes("docx") || allowed.includes("txt"), "DOCX allows word/txt", results);
    assert(blocked.includes("jpg") || blocked.includes("png"), "DOCX blocks images", results);

    const chipShot = path.join(OUT, `${LABEL}converter-chips-docx.png`);
    await page.screenshot({ path: chipShot, fullPage: false });

    const report = {
      base: BASE,
      at: new Date().toISOString(),
      status: "PASS",
      hindiShot,
      outTxt,
      chipShot,
      allowed,
      blocked,
      results,
    };
    fs.writeFileSync(
      path.join(OUT, `${LABEL}translator-hindi-results.json`),
      JSON.stringify(report, null, 2)
    );
    fs.writeFileSync(
      path.join(OUT, `${LABEL}translator-hindi-results.txt`),
      results.join("\n") + "\n"
    );
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    const failShot = path.join(OUT, `${LABEL}translator-hindi-FAIL.png`);
    await page.screenshot({ path: failShot, fullPage: true }).catch(() => {});
    const report = {
      base: BASE,
      at: new Date().toISOString(),
      status: "FAIL",
      error: String(e.message || e),
      results,
      failShot,
    };
    fs.writeFileSync(
      path.join(OUT, `${LABEL}translator-hindi-results.json`),
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
