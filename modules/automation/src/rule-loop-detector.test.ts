import { describe, expect, it } from "vitest";
import {
  detectRuleLoops,
  hasRuleLoop,
  type RuleEdge,
  ruleLoopNodes,
} from "./rule-loop-detector.js";

const edge = (from: string, to: string): RuleEdge => ({ from, to });

describe("detectRuleLoops", () => {
  it("returns empty for no edges", () => {
    expect(detectRuleLoops([])).toEqual([]);
  });

  it("returns empty for an acyclic chain", () => {
    expect(detectRuleLoops([edge("a", "b"), edge("b", "c")])).toEqual([]);
  });

  it("returns empty for a wider DAG without cycles", () => {
    const edges = [
      edge("a", "b"),
      edge("a", "c"),
      edge("b", "d"),
      edge("c", "d"),
    ];
    expect(detectRuleLoops(edges)).toEqual([]);
  });

  it("detects a self-loop as a length-1 cycle", () => {
    expect(detectRuleLoops([edge("a", "a")])).toEqual([["a"]]);
  });

  it("detects a two-node cycle starting at the minimum node", () => {
    expect(detectRuleLoops([edge("a", "b"), edge("b", "a")])).toEqual([
      ["a", "b"],
    ]);
  });

  it("rotates the cycle to begin with its minimum node", () => {
    // El minimo del ciclo es "b" aunque la primera arista salga de "c".
    expect(detectRuleLoops([edge("c", "b"), edge("b", "c")])).toEqual([
      ["b", "c"],
    ]);
  });

  it("detects a three-node cycle in edge direction", () => {
    const edges = [edge("a", "b"), edge("b", "c"), edge("c", "a")];
    expect(detectRuleLoops(edges)).toEqual([["a", "b", "c"]]);
  });

  it("ignores an acyclic tail hanging off a cycle", () => {
    const edges = [
      edge("a", "b"),
      edge("b", "c"),
      edge("c", "a"),
      edge("c", "d"),
    ];
    expect(detectRuleLoops(edges)).toEqual([["a", "b", "c"]]);
  });

  it("finds two disjoint cycles sorted deterministically", () => {
    const edges = [
      edge("c", "d"),
      edge("d", "c"),
      edge("a", "b"),
      edge("b", "a"),
    ];
    expect(detectRuleLoops(edges)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("finds two cycles sharing a node (figure-eight)", () => {
    const edges = [
      edge("a", "b"),
      edge("b", "a"),
      edge("b", "c"),
      edge("c", "b"),
    ];
    expect(detectRuleLoops(edges)).toEqual([
      ["a", "b"],
      ["b", "c"],
    ]);
  });

  it("finds both two-cycles that share the hub node", () => {
    const edges = [
      edge("a", "b"),
      edge("b", "a"),
      edge("a", "c"),
      edge("c", "a"),
    ];
    expect(detectRuleLoops(edges)).toEqual([
      ["a", "b"],
      ["a", "c"],
    ]);
  });

  it("detects a self-loop alongside a two-node cycle", () => {
    const edges = [edge("a", "a"), edge("a", "b"), edge("b", "a")];
    expect(detectRuleLoops(edges)).toEqual([["a"], ["a", "b"]]);
  });

  it("collapses duplicate edges", () => {
    const edges = [edge("a", "b"), edge("a", "b"), edge("b", "a")];
    expect(detectRuleLoops(edges)).toEqual([["a", "b"]]);
  });

  it("enumerates every elementary cycle of a fully-connected triad", () => {
    const edges = [
      edge("a", "b"),
      edge("a", "c"),
      edge("b", "a"),
      edge("b", "c"),
      edge("c", "a"),
      edge("c", "b"),
    ];
    expect(detectRuleLoops(edges)).toEqual([
      ["a", "b"],
      ["a", "b", "c"],
      ["a", "c"],
      ["a", "c", "b"],
      ["b", "c"],
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const edges = [edge("a", "b"), edge("b", "c"), edge("c", "a")];
    expect(detectRuleLoops(edges)).toEqual(detectRuleLoops(edges));
  });

  it("does not depend on the input order of edges", () => {
    const forward = [edge("a", "b"), edge("b", "c"), edge("c", "a")];
    const shuffled = [edge("c", "a"), edge("a", "b"), edge("b", "c")];
    expect(detectRuleLoops(shuffled)).toEqual(detectRuleLoops(forward));
  });
});

describe("hasRuleLoop", () => {
  it("is false for an acyclic graph", () => {
    expect(hasRuleLoop([edge("a", "b"), edge("b", "c")])).toBe(false);
  });

  it("is false for no edges", () => {
    expect(hasRuleLoop([])).toBe(false);
  });

  it("is true for a self-loop", () => {
    expect(hasRuleLoop([edge("a", "a")])).toBe(true);
  });

  it("is true when a cycle exists", () => {
    expect(hasRuleLoop([edge("a", "b"), edge("b", "a")])).toBe(true);
  });
});

describe("ruleLoopNodes", () => {
  it("returns empty for an acyclic graph", () => {
    expect(ruleLoopNodes([edge("a", "b"), edge("b", "c")])).toEqual([]);
  });

  it("collects the sorted unique nodes involved in any loop", () => {
    const edges = [
      edge("a", "b"),
      edge("b", "a"),
      edge("b", "c"),
      edge("c", "b"),
    ];
    expect(ruleLoopNodes(edges)).toEqual(["a", "b", "c"]);
  });

  it("excludes nodes that only sit on acyclic tails", () => {
    const edges = [edge("a", "b"), edge("b", "a"), edge("a", "z")];
    expect(ruleLoopNodes(edges)).toEqual(["a", "b"]);
  });
});
