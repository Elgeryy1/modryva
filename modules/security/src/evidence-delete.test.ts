import { describe, expect, it } from "vitest";
import {
  detectEvidenceDeletion,
  type EvidenceEvent,
} from "./evidence-delete.js";

const msg = (ms: number, provocative = false): EvidenceEvent => ({
  kind: "message",
  ms,
  provocative,
});

const del = (ms: number, provocative = false): EvidenceEvent => ({
  kind: "delete",
  ms,
  provocative,
});

const NO_PATTERN = "Sin borrado rápido de mensajes provocativos";

describe("detectEvidenceDeletion", () => {
  it("returns not suspicious for no events", () => {
    expect(detectEvidenceDeletion([], 5_000)).toEqual({
      suspicious: false,
      reason: NO_PATTERN,
    });
  });

  it("flags a provocative message deleted within quickMs", () => {
    const events = [msg(1_000, true), del(1_600)];
    expect(detectEvidenceDeletion(events, 1_000)).toEqual({
      suspicious: true,
      reason: "Borró un mensaje provocativo 600ms después de enviarlo",
    });
  });

  it("does not flag a non-provocative message followed by a delete", () => {
    const events = [msg(1_000, false), del(1_100)];
    expect(detectEvidenceDeletion(events, 1_000)).toEqual({
      suspicious: false,
      reason: NO_PATTERN,
    });
  });

  it("does not flag when the delete precedes the provocative message", () => {
    const events = [del(500), msg(1_000, true)];
    expect(detectEvidenceDeletion(events, 5_000)).toEqual({
      suspicious: false,
      reason: NO_PATTERN,
    });
  });

  it("treats an instantaneous delete (gap 0) as suspicious", () => {
    const events = [msg(2_000, true), del(2_000)];
    expect(detectEvidenceDeletion(events, 1_000)).toEqual({
      suspicious: true,
      reason: "Borró un mensaje provocativo 0ms después de enviarlo",
    });
  });

  it("excludes a gap exactly equal to quickMs (strict less-than)", () => {
    const events = [msg(0, true), del(1_000)];
    expect(detectEvidenceDeletion(events, 1_000)).toEqual({
      suspicious: false,
      reason: NO_PATTERN,
    });
  });

  it("flags a gap just under quickMs", () => {
    const events = [msg(0, true), del(999)];
    expect(detectEvidenceDeletion(events, 1_000)).toEqual({
      suspicious: true,
      reason: "Borró un mensaje provocativo 999ms después de enviarlo",
    });
  });

  it("returns not suspicious when there are no delete events", () => {
    const events = [msg(0, true), msg(500, true)];
    expect(detectEvidenceDeletion(events, 5_000)).toEqual({
      suspicious: false,
      reason: NO_PATTERN,
    });
  });

  it("returns not suspicious for a non-positive quickMs", () => {
    const events = [msg(1_000, true), del(1_000)];
    expect(detectEvidenceDeletion(events, 0)).toEqual({
      suspicious: false,
      reason: NO_PATTERN,
    });
    expect(detectEvidenceDeletion(events, -100)).toEqual({
      suspicious: false,
      reason: NO_PATTERN,
    });
  });

  it("reports the smallest qualifying gap across several provocative messages", () => {
    const events = [msg(0, true), msg(800, true), del(1_000)];
    expect(detectEvidenceDeletion(events, 5_000)).toEqual({
      suspicious: true,
      reason: "Borró un mensaje provocativo 200ms después de enviarlo",
    });
  });

  it("ignores the provocative flag on delete events", () => {
    const events = [msg(0, false), del(200, true)];
    expect(detectEvidenceDeletion(events, 5_000)).toEqual({
      suspicious: false,
      reason: NO_PATTERN,
    });
  });

  it("tolerates events listed out of chronological order", () => {
    const events = [del(1_200), msg(1_000, true)];
    expect(detectEvidenceDeletion(events, 1_000)).toEqual({
      suspicious: true,
      reason: "Borró un mensaje provocativo 200ms después de enviarlo",
    });
  });

  it("finds a qualifying delete among several deletes", () => {
    const events = [msg(0, true), del(9_000), del(400), del(20_000)];
    expect(detectEvidenceDeletion(events, 1_000)).toEqual({
      suspicious: true,
      reason: "Borró un mensaje provocativo 400ms después de enviarlo",
    });
  });

  it("does not flag when the only provocative delete is too slow", () => {
    const events = [msg(0, true), del(5_000)];
    expect(detectEvidenceDeletion(events, 1_000)).toEqual({
      suspicious: false,
      reason: NO_PATTERN,
    });
  });

  it("is deterministic for identical inputs", () => {
    const events = [msg(0, true), del(300), msg(1_000, true), del(1_100)];
    const first = detectEvidenceDeletion(events, 2_000);
    const second = detectEvidenceDeletion(events, 2_000);
    expect(first).toEqual(second);
    expect(first).toEqual({
      suspicious: true,
      reason: "Borró un mensaje provocativo 100ms después de enviarlo",
    });
  });

  it("picks the closest message-delete pair even with interleaving", () => {
    const events = [msg(0, true), del(100), msg(50, false), del(2_000)];
    expect(detectEvidenceDeletion(events, 5_000)).toEqual({
      suspicious: true,
      reason: "Borró un mensaje provocativo 100ms después de enviarlo",
    });
  });
});
