/**
 * Google Login gate + admin dashboard E2E (no real Google OAuth without secrets).
 * Run with: node scripts/e2e-login-admin.cjs
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
  });
  const page = await context.newPage();
  const results = [];

  function assert(cond, msg) {
    if (!cond) throw new Error(msg);
    results.push("PASS: " + msg);
  }

  await page.goto(BASE, { waitUntil: "networkidle" });

  const loginBtn = page.getByRole("button", { name: "Login" }).first();
  assert(await loginBtn.isVisible(), "Header shows Login");
  assert(
    (await page.getByText("RECOGNIZE ID").count()) === 0,
    "No RECOGNIZE ID on home"
  );

  await page.locator("#tools").scrollIntoViewIfNeeded();
  assert(
    await page.getByText("Google login required").isVisible(),
    "Tools gated with Google login required"
  );
  await page.screenshot({
    path: path.join(OUT, "google-gate-locked.png"),
    fullPage: false,
  });

  await loginBtn.click();
  assert(
    await page.getByText("Login with Google").isVisible(),
    "Dialog title is Login with Google"
  );
  assert(
    await page.getByRole("button", { name: /Continue with Google/i }).isVisible(),
    "Continue with Google button visible"
  );
  // Name-only field must be gone
  assert(
    (await page.getByLabel("Your name").count()) === 0,
    "Name-only login field removed"
  );

  // Without accepting terms, Google click shows error
  await page.getByRole("button", { name: /Continue with Google/i }).click();
  await page.waitForTimeout(400);
  assert(
    await page.getByText(/accept the Terms/i).isVisible(),
    "Requires Terms acceptance"
  );

  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /Continue with Google/i }).click();
  await page.waitForTimeout(800);
  // Either redirects toward Google, or shows not-configured notice
  const notConfigured = await page
    .getByText(/not configured|GOOGLE_CLIENT/i)
    .count();
  const url = page.url();
  assert(
    notConfigured > 0 ||
      url.includes("accounts.google.com") ||
      url.includes("/api/auth"),
    "Google flow starts or shows missing-credentials notice"
  );
  await page.screenshot({
    path: path.join(OUT, "google-login-dialog.png"),
    fullPage: false,
  });

  // Name-only API removed
  const legacy = await page.request.post(BASE + "/api/auth/login", {
    data: { name: "Should Fail" },
  });
  assert(legacy.status() === 410, "Legacy name login returns 410");

  // Admin still works with hardcoded owner creds
  await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
  if (await page.getByText("Usage dashboard").count()) {
    await page.getByRole("button", { name: "Log out" }).last().click();
    await page.waitForTimeout(500);
  }
  await page.getByLabel("Username").fill("bapattanmay@gmail.com");
  await page.getByLabel("Password").fill("Bapattanmay@12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(800);
  assert(
    await page.getByText("Usage dashboard").isVisible(),
    "Admin dashboard with owner credentials"
  );
  await page.screenshot({
    path: path.join(OUT, "admin-after-google-gate.png"),
    fullPage: true,
  });

  await page.goto(BASE + "/privacy", { waitUntil: "networkidle" });
  assert(
    await page.getByText("Google sign-in").first().isVisible(),
    "Privacy discloses Google sign-in"
  );

  fs.writeFileSync(
    path.join(OUT, "google-gate-e2e-results.txt"),
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
