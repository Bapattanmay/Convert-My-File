/**
 * Record a headed walkthrough video of Login → tools → admin.
 * Usage: node scripts/record-login-walkthrough.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:43127";
const OUT = process.env.PROOF_DIR || "/cursor/stores/self/media";
const VIDEO_DIR = path.join(OUT, "_video-tmp");

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 800 } },
    geolocation: { latitude: 13.0827, longitude: 80.2707 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: "networkidle" });
  // Ensure logged out
  const logout = page.getByRole("button", { name: "Log out" });
  if (await logout.count()) {
    await logout.first().click();
    await sleep(600);
  }
  await sleep(800);

  await page.locator("#tools").scrollIntoViewIfNeeded();
  await sleep(1200);

  await page.getByRole("button", { name: "Login" }).first().click();
  await sleep(500);
  await page.getByLabel("Your name").fill("Walkthrough User");
  await page.locator('input[type="checkbox"]').check();
  await sleep(400);
  await page.getByRole("button", { name: "Continue to workspace" }).click();
  await sleep(1200);

  await page.getByRole("tab", { name: "Translator" }).click();
  await sleep(700);
  await page.getByRole("tab", { name: "Merger" }).click();
  await sleep(700);
  await page.getByRole("tab", { name: "Compressor" }).click();
  await sleep(700);

  await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
  await sleep(600);
  // Admin logout if already in
  const adminLogout = page.getByRole("button", { name: "Log out" }).last();
  if (await page.getByText("Usage dashboard").count()) {
    await adminLogout.click();
    await sleep(600);
  }
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("ConvertMyFileAdmin2026!");
  await sleep(400);
  await page.getByRole("button", { name: "Sign in" }).click();
  await sleep(1500);
  await page.screenshot({
    path: path.join(OUT, "login-admin-walkthrough-final.png"),
    fullPage: true,
  });
  await sleep(1500);

  await context.close();
  await browser.close();

  const videos = fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith(".webm"));
  if (!videos.length) throw new Error("No video recorded");
  const dest = path.join(OUT, "login-admin-walkthrough.webm");
  fs.renameSync(path.join(VIDEO_DIR, videos[0]), dest);
  fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
  console.log("Saved", dest);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
