import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatAdminLocation } from "./admin-metrics";

describe("formatAdminLocation", () => {
  it("shows city and lat/lng without source/IP meta noise", () => {
    const f = formatAdminLocation({
      city: "Pune",
      region: "Maharashtra",
      country: "India",
      latitude: 18.5204,
      longitude: 73.8567,
      source: "browser_geolocation",
      ip: "203.0.113.10",
    });
    assert.match(f.cityLine, /Pune/);
    assert.equal(f.coords, "18.5204, 73.8567");
    assert.equal(f.meta, "");
    assert.doesNotMatch(f.cityLine, /browser geolocation/i);
    assert.doesNotMatch(f.meta, /203\.0\.113/);
  });

  it("shows coords when city missing (IP estimate pending)", () => {
    const f = formatAdminLocation({
      source: "ip_approximate",
      latitude: 19.076,
      longitude: 72.8777,
      ip: "198.51.100.2",
    });
    assert.equal(f.cityLine, "—");
    assert.equal(f.coords, "19.0760, 72.8777");
    assert.equal(f.meta, "");
  });
});
