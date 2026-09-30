import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
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
});

describe("normalizeCityName", () => {
  it("strips Corporation suffixes", () => {
    assert.equal(normalizeCityName("Chennai Corporation"), "Chennai");
    assert.equal(
      normalizeCityName("Greater Mumbai Municipal Corporation"),
      "Greater Mumbai"
    );
  });
});

describe("reverseGeocode", () => {
  it("resolves 13.0325, 80.2459 to Chennai", async () => {
    const geo = await reverseGeocode(13.0325, 80.2459);
    assert.match(geo.city || "", /Chennai/i, `city=${geo.city}`);
    assert.match(geo.region || "", /Tamil/i);
    assert.match(geo.country || "", /India/i);
  });
});
