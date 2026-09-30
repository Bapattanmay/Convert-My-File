/**
 * Admin location display contract — city + lat/lng.
 * Renders the same table/detail markup the dashboard uses (formatAdminLocation)
 * and screenshots proof. Full /admin SSR still requires Google allowlist.
 *
 *   BASE_URL=http://127.0.0.1:43127 PROOF_LABEL=admin-loc- \
 *     node scripts/e2e-admin-location.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43127";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";
const LABEL = process.env.PROOF_LABEL || "admin-loc-";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function formatAdminLocation(loc) {
  const cityLine =
    [loc?.city, loc?.region, loc?.country].filter(Boolean).join(", ") || "—";
  const coords =
    typeof loc?.latitude === "number" &&
    typeof loc?.longitude === "number" &&
    Number.isFinite(loc.latitude) &&
    Number.isFinite(loc.longitude)
      ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`
      : null;
  const src = (loc?.source || "unknown").replace(/_/g, " ");
  const meta = loc?.ip ? `${src} · ${loc.ip}` : src;
  return { cityLine, coords, meta };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const results = {
    at: new Date().toISOString(),
    base: BASE,
    unit: { pass: false, detail: "" },
    table: { pass: false, detail: "" },
    detail: { pass: false, detail: "" },
    liveHome: { pass: false, detail: "" },
    status: "FAIL",
  };

  // Unit suite for formatAdminLocation
  try {
    execFileSync(
      process.execPath,
      ["--import", "tsx", "--test", "src/lib/admin-location.test.ts"],
      { cwd: path.join(__dirname, ".."), stdio: "pipe" }
    );
    results.unit = { pass: true, detail: "formatAdminLocation unit PASS" };
    console.log("PASS  unit —", results.unit.detail);
  } catch (e) {
    results.unit = {
      pass: false,
      detail: String(e.stdout || e.stderr || e.message || e).slice(0, 200),
    };
    throw new Error("unit failed: " + results.unit.detail);
  }

  const browserGeo = {
    city: "Pune",
    region: "Maharashtra",
    country: "India",
    latitude: 18.5204,
    longitude: 73.8567,
    source: "browser_geolocation",
    ip: "203.0.113.10",
  };
  const ipGeo = {
    city: "Mumbai",
    region: "Maharashtra",
    country: "India",
    latitude: 19.076,
    longitude: 72.8777,
    source: "ip_approximate",
    ip: "198.51.100.2",
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });

  try {
    const b = formatAdminLocation(browserGeo);
    const i = formatAdminLocation(ipGeo);
    const html = `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:system-ui;background:#F3F0E8;padding:24px;color:#0F172A}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden}
  td,th{border-bottom:1px solid #E4DDD0;padding:12px 16px;text-align:left;font-size:14px}
  .city{font-weight:600}.coords{font-family:ui-monospace,monospace;font-size:12px;color:#475569}
  .meta{font-size:11px;color:#94A3B8}.panel{margin-top:20px;background:#fff;border-radius:16px;padding:16px;border:1px solid #E4DDD0}
</style></head><body>
<h1>Admin location proof</h1>
<table>
  <thead><tr><th>Visitor</th><th>Location</th></tr></thead>
  <tbody>
    <tr>
      <td>Geo Visitor</td>
      <td data-testid="admin-location-cell">
        <div class="city">${b.cityLine.split(",")[0]}</div>
        <div class="coords">${b.coords || "coords unavailable"}</div>
        <div class="meta">${b.meta}</div>
      </td>
    </tr>
    <tr>
      <td>IP Visitor</td>
      <td data-testid="admin-location-cell-ip">
        <div class="city">${i.cityLine.split(",")[0]}</div>
        <div class="coords">${i.coords || "coords unavailable"}</div>
        <div class="meta">${i.meta}</div>
      </td>
    </tr>
  </tbody>
</table>
<div class="panel" data-testid="admin-location-detail">
  <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#94A3B8">Location</div>
  <div style="font-weight:600;margin-top:8px">${b.cityLine}</div>
  <div class="coords" style="margin-top:6px">${b.coords}</div>
  <div class="meta" style="margin-top:6px">${b.meta}</div>
</div>
</body></html>`;

    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const cell = await page.locator('[data-testid="admin-location-cell"]').innerText();
    assert(/Pune/i.test(cell), `table city: ${cell}`);
    assert(/18\.5204/.test(cell) && /73\.8567/.test(cell), `table coords: ${cell}`);
    results.table = { pass: true, detail: cell.replace(/\s+/g, " ").trim() };
    console.log("PASS  table —", results.table.detail);

    const detail = await page
      .locator('[data-testid="admin-location-detail"]')
      .innerText();
    assert(/Pune/i.test(detail), `detail city: ${detail}`);
    assert(
      /18\.5204/.test(detail) && /73\.8567/.test(detail),
      `detail coords: ${detail}`
    );
    results.detail = { pass: true, detail: detail.replace(/\s+/g, " ").trim() };
    console.log("PASS  detail —", results.detail.detail);

    await page.screenshot({
      path: path.join(OUT, `${LABEL}admin.png`),
      fullPage: true,
    });

    const home = await page.goto(BASE + "/", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    results.liveHome = {
      pass: home && home.status() === 200,
      detail: `home HTTP ${home ? home.status() : "none"}`,
    };
    console.log(
      (results.liveHome.pass ? "PASS" : "FAIL") + "  live home —",
      results.liveHome.detail
    );

    results.status =
      results.unit.pass &&
      results.table.pass &&
      results.detail.pass &&
      results.liveHome.pass
        ? "PASS"
        : "FAIL";
  } catch (e) {
    console.error("FAIL", e.message || e);
    await page
      .screenshot({ path: path.join(OUT, `${LABEL}FAIL.png`), fullPage: true })
      .catch(() => {});
    if (!results.table.pass) results.table.detail = String(e.message || e);
    else if (!results.detail.pass)
      results.detail.detail = String(e.message || e);
    results.status = "FAIL";
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    path.join(OUT, `${LABEL}results.json`),
    JSON.stringify(results, null, 2)
  );
  const lines = [
    `Admin location — ${results.status}`,
    `base: ${BASE}`,
    `unit: ${results.unit.pass ? "PASS" : "FAIL"} — ${results.unit.detail}`,
    `table: ${results.table.pass ? "PASS" : "FAIL"} — ${results.table.detail}`,
    `detail: ${results.detail.pass ? "PASS" : "FAIL"} — ${results.detail.detail}`,
    `liveHome: ${results.liveHome.pass ? "PASS" : "FAIL"} — ${results.liveHome.detail}`,
  ];
  fs.writeFileSync(path.join(OUT, `${LABEL}results.txt`), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  if (results.status !== "PASS") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
