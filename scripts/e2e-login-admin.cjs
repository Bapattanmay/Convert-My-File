/**
 * Login gate + admin dashboard E2E proof script.
 * Run with: node scripts/e2e-login-admin.cjs
 * Requires: npm run dev on 127.0.0.1:43127, playwright installed.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43127";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    geolocation: { latitude: 13.0827, longitude: 80.2707 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  const results = [];

  function assert(cond, msg) {
    if (!cond) throw new Error(msg);
    results.push("PASS: " + msg);
  }

  await page.goto(BASE, { waitUntil: "networkidle" });

  // 1) Login button rename
  const loginBtn = page.getByRole("button", { name: "Login" }).first();
  assert(await loginBtn.isVisible(), "Header shows Login (not RECOGNIZE ID)");
  const recognize = await page.getByText("RECOGNIZE ID").count();
  assert(recognize === 0, "No RECOGNIZE ID on home");

  // 2) Gate visible
  await page.locator("#tools").scrollIntoViewIfNeeded();
  assert(
    await page.getByText("Login required").isVisible(),
    "Tools gated with Login required"
  );
  await page.screenshot({
    path: path.join(OUT, "login-gate-locked.png"),
    fullPage: false,
  });

  // 3) Login
  await loginBtn.click();
  await page.getByLabel("Your name").fill("E2E Proof User");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Continue to workspace" }).click();
  await page.waitForTimeout(800);
  assert(
    await page.getByText("E2E Proof User").isVisible(),
    "Header shows logged-in name"
  );
  assert(
    (await page.getByText("Login required").count()) === 0,
    "Gate overlay removed after login"
  );
  await page.screenshot({
    path: path.join(OUT, "login-gate-unlocked.png"),
    fullPage: false,
  });

  // 4) Track features via tabs
  await page.getByRole("tab", { name: "Translator" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("tab", { name: "Merger" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("tab", { name: "Compressor" }).click();
  await page.waitForTimeout(400);

  // Heartbeat once
  await page.request.post(BASE + "/api/track", {
    data: { seconds: 30, feature: "compressor" },
  });

  // 5) Admin dashboard
  await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("ConvertMyFileAdmin2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(800);
  assert(
    await page.getByText("Usage dashboard").isVisible(),
    "Admin dashboard visible"
  );
  assert(
    await page.getByRole("cell", { name: /E2E Proof User/ }).first().isVisible(),
    "Admin shows E2E Proof User session"
  );
  const body = await page.locator("table").innerText();
  assert(/translator|merger|compressor|converter/i.test(body), "Features listed");
  await page.screenshot({
    path: path.join(OUT, "admin-usage-dashboard.png"),
    fullPage: true,
  });

  // Privacy disclosure
  await page.goto(BASE + "/privacy", { waitUntil: "networkidle" });
  assert(
    await page.getByText("What we collect after Login").isVisible(),
    "Privacy discloses Login analytics"
  );
  await page.screenshot({
    path: path.join(OUT, "privacy-disclosure.png"),
    fullPage: false,
  });

  fs.writeFileSync(
    path.join(OUT, "login-admin-e2e-results.txt"),
    results.join("\n") + "\n"
  );
  console.log(results.join("\n"));
  console.log("Proofs written to", OUT);
  await browser.close();
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
