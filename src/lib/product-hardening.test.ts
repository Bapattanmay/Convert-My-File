import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("product hardening — static guarantees", () => {
  it("P2: no HTML-as-DOCX helper / mime spoof in convert.ts", () => {
    const src = read("src/lib/convert.ts");
    assert.ok(!src.includes("function textToDocBlob"));
    assert.ok(
      !src.includes(
        'type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"'
      )
    );
    assert.ok(src.includes("blocksToDocxBlob"));
  });

  it("P3: CSV path uses SheetJS, not naive comma split", () => {
    const src = read("src/lib/convert.ts");
    // Exclude comments; executable code must not use naive per-line CSV splits
    const code = src
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    assert.ok(!code.includes('line.split(",")'));
    assert.ok(src.includes("XLSX.read(csv"));
    assert.ok(src.includes("sheet_to_csv"));
  });

  it("P4: Premium has no cookie/localStorage mock unlock", () => {
    const access = read("src/lib/premium-access.ts");
    const route = read("src/app/api/premium/route.ts");
    const hook = read("src/hooks/use-premium.ts");
    assert.ok(!access.includes("PREMIUM_COOKIE"));
    assert.ok(!access.includes("cmf_premium"));
    assert.ok(!access.includes("localStorage"));
    assert.ok(!route.includes("cookies.set"));
    assert.ok(!route.includes("Mock Upgrade"));
    assert.ok(!hook.includes("localStorage"));
    assert.ok(!hook.includes("writeLocalPremium"));
    assert.ok(route.includes("coming_soon"));
    assert.ok(route.includes("Razorpay") || route.includes("Cashfree"));
  });

  it("P5: production fail-closed secrets; no ADMIN_USERNAME/PASSWORD", () => {
    const secrets = read("src/lib/runtime-secrets.ts");
    const auth = read("src/auth.ts");
    const admin = read("src/lib/admin-auth.ts");
    const store = read("src/lib/usage-store.ts");
    assert.ok(secrets.includes("assertProductionSecrets"));
    assert.ok(auth.includes("required in production"));
    assert.ok(
      admin.includes("Fail-closed") || admin.includes("isProductionRuntime")
    );
    assert.ok(!store.includes("ADMIN_USERNAME"));
    assert.ok(!store.includes("ADMIN_PASSWORD"));
    assert.ok(!store.includes("adminCredentials"));
    assert.ok(existsSync(join(root, "src/instrumentation.ts")));
  });

  it("P6: no browser geolocation; files-on-device positioning", () => {
    const authProv = read("src/components/auth-provider.tsx");
    const track = read("src/app/api/track/route.ts");
    const hero = read("src/components/hero-section.tsx");
    assert.ok(!authProv.includes("navigator.geolocation"));
    assert.ok(!authProv.includes("getCurrentPosition"));
    assert.ok(!track.includes("browser_geolocation"));
    assert.ok(track.includes("ip_approximate"));
    assert.ok(/files stay on your device/i.test(hero));
  });

  it("P7: free tools ungated; Premium gated", () => {
    const tools = read("src/components/tools-section.tsx");
    assert.ok(tools.includes("premiumGated"));
    assert.ok(/no Google login[\s\S]*required/i.test(tools));
    assert.ok(tools.includes("Google login for Premium"));
    assert.ok(!tools.includes("Tools unlock after Google Login"));
  });

  it("P1: compressor copy avoids false exact-size promises", () => {
    const tool = read("src/components/tools/compressor-tool.tsx");
    assert.ok(/as close as possible/i.test(tool));
    assert.ok(tool.includes("approachTargetSize"));
    assert.ok(!tool.includes("Exact target size"));
    assert.ok(!tool.includes("to exact size"));
    assert.ok(!tool.includes("exact KB/MB"));
  });
});
