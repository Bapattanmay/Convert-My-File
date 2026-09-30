import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  enrichLocationCity,
  lookupIpLocation,
  normalizeCityName,
  reverseGeocode,
} from "./geo";

describe("lookupIpLocation", () => {
  it("returns Local for loopback with ip_approximate source", async () => {
    const loc = await lookupIpLocation("127.0.0.1");
    assert.equal(loc.source, "ip_approximate");
    assert.equal(loc.city, "Local");
  });

  it("resolves truncated IP 49.249.37.0 to city + lat/lng", async () => {
    const loc = await lookupIpLocation("49.249.37.0");
    assert.ok(loc.city, `expected city, got ${JSON.stringify(loc)}`);
    assert.equal(typeof loc.latitude, "number");
    assert.equal(typeof loc.longitude, "number");
    assert.match(loc.city || "", /Chennai|Mumbai|India|Tamil|Delhi|Bengaluru|Bangalore|Hyderabad|Pune/i);
  });
});

describe("normalizeCityName", () => {
  it("strips Corporation suffixes", () => {
    assert.equal(normalizeCityName("Chennai Corporation"), "Chennai");
  });
});

describe("reverseGeocode", () => {
  it("resolves 13.0325, 80.2459 to Chennai", async () => {
    const geo = await reverseGeocode(13.0325, 80.2459);
    assert.match(geo.city || "", /Chennai/i, `city=${geo.city}`);
  });
});

describe("enrichLocationCity", () => {
  it("fills city + coords from IP-only visitor location", async () => {
    const enriched = await enrichLocationCity({
      ip: "49.249.37.0",
      source: "ip_approximate",
    } as { ip: string; city?: string });
    assert.ok(enriched, "expected enrichment");
    assert.ok(enriched!.city, `city missing: ${JSON.stringify(enriched)}`);
    assert.equal(typeof enriched!.latitude, "number");
    assert.equal(typeof enriched!.longitude, "number");
  });
});
