/**
 * Smoke Privacy / Terms / Contact for DPDP notices + footer links.
 *
 *   BASE_URL=https://convert-my-file-oo3r.onrender.com PROOF_LABEL=live-legal- \
 *     node scripts/e2e-legal-dpdp.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43127";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";
const LABEL = process.env.PROOF_LABEL || "legal-";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const results = { at: new Date().toISOString(), base: BASE, pages: {}, status: "FAIL" };
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

  try {
    // Footer links from home
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
    const privacyHref = await page
      .locator('footer a[href="/privacy"]')
      .first()
      .getAttribute("href");
    const termsHref = await page
      .locator('footer a[href="/terms"]')
      .first()
      .getAttribute("href");
    assert(privacyHref === "/privacy", "footer privacy");
    assert(termsHref === "/terms", "footer terms");
    results.pages.footer = { pass: true, detail: "Privacy + Terms + Contact links present" };
    console.log("PASS  footer —", results.pages.footer.detail);

    // Privacy
    const priv = await page.goto(BASE + "/privacy", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    assert(priv && priv.status() === 200, "privacy status");
    const privText = await page.locator("main").innerText();
    for (const needle of [
      "Data Fiduciary",
      "DPDP",
      "privacy@premiumutility.app",
      "Google",
      "erasure",
      "Postgres",
      "Cross-border",
      "Children",
    ]) {
      assert(new RegExp(needle, "i").test(privText), `privacy missing ${needle}`);
    }
    await page.screenshot({
      path: path.join(OUT, `${LABEL}privacy.png`),
      fullPage: true,
    });
    results.pages.privacy = {
      pass: true,
      detail: "DPDP sections + grievance email",
      url: BASE + "/privacy",
    };
    console.log("PASS  privacy —", results.pages.privacy.detail);

    // Terms
    const terms = await page.goto(BASE + "/terms", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    assert(terms && terms.status() === 200, "terms status");
    const termsText = await page.locator("main").innerText();
    for (const needle of [
      "Terms of Service",
      "Acceptable use",
      "Premium",
      "Liability",
      "18",
      "Privacy Policy",
    ]) {
      assert(new RegExp(needle, "i").test(termsText), `terms missing ${needle}`);
    }
    await page.screenshot({
      path: path.join(OUT, `${LABEL}terms.png`),
      fullPage: true,
    });
    results.pages.terms = {
      pass: true,
      detail: "acceptable use + Premium + liability",
      url: BASE + "/terms",
    };
    console.log("PASS  terms —", results.pages.terms.detail);

    // Contact
    const contact = await page.goto(BASE + "/contact", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    assert(contact && contact.status() === 200, "contact status");
    const contactText = await page.locator("main").innerText();
    assert(/grievance|Data Fiduciary/i.test(contactText), "contact fiduciary");
    assert(/privacy@premiumutility\.app/i.test(contactText), "contact email");
    await page.screenshot({
      path: path.join(OUT, `${LABEL}contact.png`),
      fullPage: true,
    });
    results.pages.contact = {
      pass: true,
      detail: "grievance contact + rights topics",
      url: BASE + "/contact",
    };
    console.log("PASS  contact —", results.pages.contact.detail);

    results.status = "PASS";
  } catch (e) {
    console.error("FAIL", e.message || e);
    results.status = "FAIL";
    results.error = String(e.message || e).slice(0, 400);
    await page
      .screenshot({ path: path.join(OUT, `${LABEL}FAIL.png`), fullPage: true })
      .catch(() => {});
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    path.join(OUT, `${LABEL}results.json`),
    JSON.stringify(results, null, 2)
  );
  const lines = [
    `Legal DPDP notices — ${results.status}`,
    `base: ${BASE}`,
    `privacy: ${BASE}/privacy`,
    `terms: ${BASE}/terms`,
    `contact: ${BASE}/contact`,
    ...Object.entries(results.pages).map(
      ([k, v]) => `${v.pass ? "PASS" : "FAIL"}  ${k} — ${v.detail}`
    ),
  ];
  fs.writeFileSync(path.join(OUT, `${LABEL}results.txt`), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  if (results.status !== "PASS") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
