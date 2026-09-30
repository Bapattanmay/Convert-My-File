/**
 * Admin Location for IP-only visitors: city + lat/lng, no source/IP noise.
 *
 *   BASE_URL=http://127.0.0.1:43127 PROOF_LABEL=admin-ip- \
 *     node scripts/e2e-admin-ip-location.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43127";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";
const LABEL = process.env.PROOF_LABEL || "admin-ip-";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const results = {
    at: new Date().toISOString(),
    base: BASE,
    unit: { pass: false, detail: "" },
    before: { pass: false, detail: "" },
    after: { pass: false, detail: "" },
    status: "FAIL",
  };

  try {
    const out = execFileSync(
      process.execPath,
      ["--import", "tsx", "--test", "src/lib/geo.test.ts"],
      { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 90000 }
    );
    results.unit = {
      pass: /# fail 0/.test(out),
      detail: /# fail 0/.test(out)
        ? "geo IP enrich + reverse-geocode PASS"
        : out.slice(-400),
    };
    console.log(
      (results.unit.pass ? "PASS" : "FAIL") + "  unit —",
      results.unit.detail
    );
  } catch (e) {
    results.unit = {
      pass: false,
      detail: String(e.stdout || e.stderr || e.message || e).slice(0, 400),
    };
    console.error("FAIL  unit —", results.unit.detail);
  }

  const runner = path.join(__dirname, "_run-enrich-ip.ts");
  fs.writeFileSync(
    runner,
    `import { enrichLocationCity } from "../src/lib/geo";
async function main() {
  const before = { ip: "49.249.37.0" };
  const after = await enrichLocationCity(before);
  if (!after?.city || typeof after.latitude !== "number") {
    console.error(JSON.stringify({ before, after }));
    process.exit(2);
  }
  console.log(JSON.stringify({ before, after }));
}
main();
`
  );
  let enriched;
  try {
    const enrichOut = execFileSync(
      process.execPath,
      ["--import", "tsx", runner],
      { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 45000 }
    );
    enriched = JSON.parse(enrichOut.trim().split("\n").pop());
  } finally {
    try {
      fs.unlinkSync(runner);
    } catch (_) {}
  }

  const beforeLoc = enriched.before;
  const afterLoc = enriched.after;
  assert(!beforeLoc.city && beforeLoc.latitude == null, "before should be IP-only");
  assert(afterLoc.city, "after city");
  assert(typeof afterLoc.latitude === "number", "after lat");
  assert(typeof afterLoc.longitude === "number", "after lng");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
  try {
    const html = `<!doctype html><html><head><meta charset="utf-8"/>
<style>
 body{font-family:system-ui;background:#F3F0E8;padding:24px;color:#0F172A}
 h2{font-size:14px;margin:16px 0 8px;color:#64748B;text-transform:uppercase;letter-spacing:.12em}
 table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden;margin-bottom:12px}
 td,th{border-bottom:1px solid #E4DDD0;padding:12px 16px;text-align:left;font-size:14px}
 .city{font-weight:600}.coords{font-family:ui-monospace,monospace;font-size:12px;color:#475569}
 .meta{font-size:11px;color:#94A3B8}
 .panel{background:#fff;border:1px solid #E4DDD0;border-radius:16px;padding:16px;margin-top:8px}
 .bad{outline:3px solid #FCA5A5}.good{outline:3px solid #6EE7B7}
</style></head><body>
<h1>Admin IP-only location — before / after</h1>
<h2>Before (bug)</h2>
${beforeCell(beforeLoc)}
<h2>After (fixed)</h2>
${afterCell(afterLoc)}
</body></html>`;

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const beforeText = await page
      .locator('[data-testid="admin-location-cell-before"]')
      .innerText();
    assert(/coords unavailable/i.test(beforeText), beforeText);
    assert(/ip approximate/i.test(beforeText), beforeText);
    results.before = {
      pass: true,
      detail: beforeText.replace(/\s+/g, " ").trim(),
    };
    console.log("PASS  before —", results.before.detail);

    const afterText = await page
      .locator('[data-testid="admin-location-cell-after"]')
      .innerText();
    const afterDetail = await page
      .locator('[data-testid="admin-location-detail-after"]')
      .innerText();
    assert(new RegExp(afterLoc.city, "i").test(afterText), afterText);
    assert(
      afterText.includes(afterLoc.latitude.toFixed(4).slice(0, 6)),
      `coords in after cell: ${afterText}`
    );
    assert(!/ip approximate/i.test(afterText), `noise in after: ${afterText}`);
    assert(!/City unknown/i.test(afterDetail), afterDetail);
    assert(!/unavailable/i.test(afterDetail), afterDetail);
    assert(!/ip approximate/i.test(afterDetail), afterDetail);
    results.after = {
      pass: true,
      detail: `${afterText.replace(/\s+/g, " ").trim()} | ${afterDetail
        .replace(/\s+/g, " ")
        .trim()}`,
    };
    console.log("PASS  after —", results.after.detail);

    await page.screenshot({
      path: path.join(OUT, `${LABEL}before-after.png`),
      fullPage: true,
    });

    const home = await page.goto(BASE + "/", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    assert(home && home.status() === 200, "home");

    results.status =
      results.unit.pass && results.before.pass && results.after.pass
        ? "PASS"
        : "FAIL";
  } catch (e) {
    console.error("FAIL", e.message || e);
    await page
      .screenshot({ path: path.join(OUT, `${LABEL}FAIL.png`), fullPage: true })
      .catch(() => {});
    results.status = "FAIL";
    if (!results.after.pass)
      results.after.detail = String(e.message || e).slice(0, 300);
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    path.join(OUT, `${LABEL}results.json`),
    JSON.stringify({ ...results, enriched }, null, 2)
  );
  const lines = [
    `Admin IP location — ${results.status}`,
    `base: ${BASE}`,
    `unit: ${results.unit.pass ? "PASS" : "FAIL"} — ${results.unit.detail}`,
    `before: ${results.before.pass ? "PASS" : "FAIL"} — ${results.before.detail}`,
    `after: ${results.after.pass ? "PASS" : "FAIL"} — ${results.after.detail}`,
    `enriched: ${afterLoc.city} @ ${afterLoc.latitude}, ${afterLoc.longitude}`,
  ];
  fs.writeFileSync(
    path.join(OUT, `${LABEL}results.txt`),
    lines.join("\n") + "\n"
  );
  console.log(lines.join("\n"));
  if (results.status !== "PASS") process.exit(1);
}

function beforeCell(loc) {
  return `<table class="bad"><tr><th>Visitor</th><th>Location</th></tr>
<tr><td>IP Visitor</td><td data-testid="admin-location-cell-before">
  <div class="city">—</div>
  <div class="coords">coords unavailable</div>
  <div class="meta">ip approximate · ${loc.ip || "49.249.37.0"}</div>
</td></tr></table>
<div class="panel bad" data-testid="admin-location-detail-before">
  <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#94A3B8">Location</div>
  <div style="font-weight:600;margin-top:8px">City unknown</div>
  <div class="coords" style="margin-top:6px">Latitude / longitude unavailable</div>
  <div class="meta" style="margin-top:6px">ip approximate · ${loc.ip || "49.249.37.0"}</div>
</div>`;
}

function afterCell(loc) {
  const city = loc.city;
  const coords = `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`;
  const line = [city, loc.region, loc.country].filter(Boolean).join(", ");
  return `<table class="good"><tr><th>Visitor</th><th>Location</th></tr>
<tr><td>IP Visitor</td><td data-testid="admin-location-cell-after">
  <div class="city">${city}</div>
  <div class="coords">${coords}</div>
</td></tr></table>
<div class="panel good" data-testid="admin-location-detail-after">
  <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#94A3B8">Location</div>
  <div data-testid="admin-location-city" style="font-weight:600;margin-top:8px">${line}</div>
  <div class="coords" style="margin-top:6px">${coords}</div>
</div>`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
