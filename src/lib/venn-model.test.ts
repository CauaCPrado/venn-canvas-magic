import { describe, expect, it } from "vitest";
import { createBasicSet, createDerivedSet, emptyDiagram, exclusiveSize, unionTotal } from "./venn-model";

describe("venn totals", () => {
  it("Somente A = 3, Somente B = 8 when A∩B = 7", () => {
    let d = createBasicSet(emptyDiagram(), { name: "A", count: 10 });
    d = createBasicSet(d, { name: "B", count: 15 });
    d = createDerivedSet(d, ["s1", "s2"], 7);
    expect(exclusiveSize(d, "s1")).toBe(3);
    expect(exclusiveSize(d, "s2")).toBe(8);
    expect(exclusiveSize(d, "s3")).toBe(7);
    expect(unionTotal(d)).toBe(18);
  });
  it("triple intersection is not subtracted twice", () => {
    let d = createBasicSet(emptyDiagram(), { count: 10 });
    d = createBasicSet(d, { count: 10 });
    d = createBasicSet(d, { count: 10 });
    d = createDerivedSet(d, ["s1", "s2", "s3"], 2); // s4
    d = createDerivedSet(d, ["s1", "s2"], 5); // s5 -> only AB = 3
    expect(exclusiveSize(d, "s5")).toBe(3);
    expect(exclusiveSize(d, "s1")).toBe(5);
  });
  it("limits basic sets to 3", () => {
    let d = emptyDiagram();
    for (let i = 0; i < 5; i++) d = createBasicSet(d, {});
    expect(d.sets.length).toBe(3);
  });
});
