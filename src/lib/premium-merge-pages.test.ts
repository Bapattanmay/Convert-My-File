import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePageList, resolvePageIndices } from "./premium-merge";

describe("parsePageList", () => {
  it("keeps non-contiguous order", () => {
    assert.deepEqual(parsePageList("1,5,8", 9), [1, 5, 8]);
    assert.deepEqual(parsePageList("2,4,9", 9), [2, 4, 9]);
  });

  it("expands ranges and skips duplicates/out-of-bounds", () => {
    assert.deepEqual(parsePageList("8-10,3,3,0", 9), [8, 9, 3]);
  });
});

describe("resolvePageIndices", () => {
  it("prefers pages over range", () => {
    assert.deepEqual(
      resolvePageIndices({ pages: [1, 5, 8], range: { start: 1, end: 9 } }, 9),
      [0, 4, 7]
    );
  });

  it("falls back to contiguous range", () => {
    assert.deepEqual(
      resolvePageIndices({ range: { start: 3, end: 5 } }, 9),
      [2, 3, 4]
    );
  });
});
