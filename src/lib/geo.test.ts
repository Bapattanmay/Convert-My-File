import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lookupIpLocation } from "./geo";

describe("lookupIpLocation", () => {
  it("returns Local for loopback with ip_approximate source", async () => {
    const loc = await lookupIpLocation("127.0.0.1");
    assert.equal(loc.source, "ip_approximate");
    assert.equal(loc.city, "Local");
  });
});
