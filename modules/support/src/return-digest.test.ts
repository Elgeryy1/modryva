import { describe, expect, it } from "vitest";
import {
  buildReturnDigest,
  countDigestEventsByType,
  type DigestEvent,
  filterDigestEventsInRange,
  RETURN_DIGEST_EMPTY_TEXT,
  RETURN_DIGEST_MAX_HIGHLIGHTS,
  selectDigestHighlights,
} from "./return-digest.js";

const MINUTE = 60_000;

const ev = (ms: number, type: string, summary: string): DigestEvent => ({
  ms,
  type,
  summary,
});

const sample: readonly DigestEvent[] = [
  ev(0, "join", "Ana entro"),
  ev(1 * MINUTE, "message", "Bob dijo hola"),
  ev(2 * MINUTE, "message", "Carol pregunto algo"),
  ev(3 * MINUTE, "ban", "Spammer baneado"),
  ev(4 * MINUTE, "join", "Dan entro"),
];

describe("filterDigestEventsInRange", () => {
  it("keeps events within the closed range inclusive of both bounds", () => {
    const result = filterDigestEventsInRange(sample, 1 * MINUTE, 3 * MINUTE);
    expect(result.map((e) => e.summary)).toEqual([
      "Bob dijo hola",
      "Carol pregunto algo",
      "Spammer baneado",
    ]);
  });

  it("preserves the original order of events", () => {
    const shuffled = [sample[3], sample[0], sample[2]] as DigestEvent[];
    const result = filterDigestEventsInRange(shuffled, 0, 4 * MINUTE);
    expect(result).toEqual(shuffled);
  });

  it("returns empty for an inverted range", () => {
    expect(filterDigestEventsInRange(sample, 3 * MINUTE, 1 * MINUTE)).toEqual(
      [],
    );
  });

  it("returns empty when nothing falls in range", () => {
    expect(
      filterDigestEventsInRange(sample, 100 * MINUTE, 200 * MINUTE),
    ).toEqual([]);
  });

  it("returns empty for an empty input", () => {
    expect(filterDigestEventsInRange([], 0, 10)).toEqual([]);
  });

  it("includes a single event exactly on both bounds", () => {
    const one = [ev(5 * MINUTE, "join", "solo")];
    expect(filterDigestEventsInRange(one, 5 * MINUTE, 5 * MINUTE)).toEqual(one);
  });
});

describe("countDigestEventsByType", () => {
  it("counts events grouped by type", () => {
    expect(countDigestEventsByType(sample)).toEqual({
      join: 2,
      message: 2,
      ban: 1,
    });
  });

  it("returns an empty object for no events", () => {
    expect(countDigestEventsByType([])).toEqual({});
  });

  it("only lists types that occur", () => {
    const result = countDigestEventsByType([ev(0, "kick", "x")]);
    expect(result).toEqual({ kick: 1 });
    expect(Object.keys(result)).toEqual(["kick"]);
  });
});

describe("selectDigestHighlights", () => {
  it("orders highlights from most recent to oldest", () => {
    expect(selectDigestHighlights(sample)).toEqual([
      "Dan entro",
      "Spammer baneado",
      "Carol pregunto algo",
      "Bob dijo hola",
      "Ana entro",
    ]);
  });

  it("respects the limit argument", () => {
    expect(selectDigestHighlights(sample, 2)).toEqual([
      "Dan entro",
      "Spammer baneado",
    ]);
  });

  it("caps at the default max highlights", () => {
    const many: DigestEvent[] = [];
    for (let i = 0; i < 10; i += 1) {
      many.push(ev(i * MINUTE, "message", `msg-${i}`));
    }
    const result = selectDigestHighlights(many);
    expect(result).toHaveLength(RETURN_DIGEST_MAX_HIGHLIGHTS);
    expect(result[0]).toBe("msg-9");
  });

  it("is stable for events sharing the same timestamp", () => {
    const tie = [
      ev(1000, "a", "primero"),
      ev(1000, "a", "segundo"),
      ev(1000, "a", "tercero"),
    ];
    expect(selectDigestHighlights(tie)).toEqual([
      "primero",
      "segundo",
      "tercero",
    ]);
  });

  it("returns empty for a non-positive limit", () => {
    expect(selectDigestHighlights(sample, 0)).toEqual([]);
    expect(selectDigestHighlights(sample, -3)).toEqual([]);
  });

  it("returns empty for no events", () => {
    expect(selectDigestHighlights([])).toEqual([]);
  });
});

describe("buildReturnDigest", () => {
  it("returns the empty message when nothing is in range", () => {
    const result = buildReturnDigest(sample, 100 * MINUTE, 200 * MINUTE);
    expect(result.total).toBe(0);
    expect(result.counts).toEqual({});
    expect(result.highlights).toEqual([]);
    expect(result.text).toBe(RETURN_DIGEST_EMPTY_TEXT);
  });

  it("returns the empty message for an empty event list", () => {
    expect(buildReturnDigest([], 0, 10).text).toBe(RETURN_DIGEST_EMPTY_TEXT);
  });

  it("summarizes counts, total and highlights for a full range", () => {
    const result = buildReturnDigest(sample, 0, 4 * MINUTE);
    expect(result.total).toBe(5);
    expect(result.counts).toEqual({ join: 2, message: 2, ban: 1 });
    expect(result.highlights[0]).toBe("Dan entro");
    expect(result.text).toContain("Mientras no estabas pasaron 5 cosas:");
    expect(result.text).toContain("- join: 2");
    expect(result.text).toContain("Destacados:");
    expect(result.text).toContain("- Dan entro");
  });

  it("uses singular wording for exactly one event", () => {
    const result = buildReturnDigest([ev(0, "join", "Ana entro")], 0, MINUTE);
    expect(result.total).toBe(1);
    expect(result.text).toContain("Mientras no estabas paso 1 cosa:");
  });

  it("honors the range bounds when filtering", () => {
    const result = buildReturnDigest(sample, 2 * MINUTE, 3 * MINUTE);
    expect(result.total).toBe(2);
    expect(result.counts).toEqual({ message: 1, ban: 1 });
    expect(result.highlights).toEqual([
      "Spammer baneado",
      "Carol pregunto algo",
    ]);
  });

  it("is deterministic for identical inputs", () => {
    const a = buildReturnDigest(sample, 0, 4 * MINUTE);
    const b = buildReturnDigest(sample, 0, 4 * MINUTE);
    expect(a).toEqual(b);
  });
});
