/**
 * Admin panel access + API smoke (Google allowlist; no password gate).
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43127";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const results = [];
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
    results.push("PASS: " + msg);
  };

  // Anonymous admin → 404
  const adminRes = await page.request.get(BASE + "/admin");
  assert(adminRes.status() === 404, "Anonymous /admin returns 404");

  const overview = await page.request.get(BASE + "/api/admin/overview?range=7d");
  assert(overview.status() === 404, "Anonymous overview API 404");

  const visitors = await page.request.get(BASE + "/api/admin/visitors");
  assert(visitors.status() === 404, "Anonymous visitors API 404");

  const pwd = await page.request.post(BASE + "/api/auth/admin", {
    data: { username: "bapattanmay@gmail.com", password: "Bapattanmay@12345" },
  });
  assert(pwd.status() === 410, "Password admin login disabled (410)");

  await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
  await page.screenshot({
    path: path.join(OUT, "admin-anonymous-404.png"),
    fullPage: true,
  });
  assert(
    (await page.getByText(/could not be found|404|Not Found/i).count()) > 0,
    "404 page visible for anonymous admin"
  );

  fs.writeFileSync(
    path.join(OUT, "admin-panel-rebuild-results.txt"),
    results.join("\n") + "\n"
  );
  console.log(results.join("\n"));
  await browser.close();
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
