import { describe, expect, it } from "vitest";
import { buildSeasonAlbum, type SeasonAlbumEntry } from "./season-album.js";

describe("buildSeasonAlbum", () => {
  it("tallies entries by kind sorted by count desc then kind asc", () => {
    const entries: readonly SeasonAlbumEntry[] = [
      { kind: "logro", title: "Primer nivel", atMs: 30 },
      { kind: "evento", title: "Torneo", atMs: 10 },
      { kind: "logro", title: "Racha de 7", atMs: 50 },
      { kind: "momento", title: "Bienvenida", atMs: 20 },
    ];
    expect(buildSeasonAlbum(entries)).toEqual({
      total: 4,
      byKind: [
        { kind: "logro", count: 2 },
        { kind: "evento", count: 1 },
        { kind: "momento", count: 1 },
      ],
      firstAtMs: 10,
      lastAtMs: 50,
    });
  });

  it("returns an empty album for no entries", () => {
    expect(buildSeasonAlbum([])).toEqual({
      total: 0,
      byKind: [],
      firstAtMs: undefined,
      lastAtMs: undefined,
    });
  });

  it("counts a single entry and sets both span bounds to its time", () => {
    expect(
      buildSeasonAlbum([{ kind: "momento", title: "Foto", atMs: 99 }]),
    ).toEqual({
      total: 1,
      byKind: [{ kind: "momento", count: 1 }],
      firstAtMs: 99,
      lastAtMs: 99,
    });
  });

  it("ignores entries whose kind is empty or only whitespace", () => {
    const entries: readonly SeasonAlbumEntry[] = [
      { kind: "", title: "Vacio", atMs: 5 },
      { kind: "   ", title: "Espacios", atMs: 6 },
      { kind: "logro", title: "Valido", atMs: 7 },
    ];
    expect(buildSeasonAlbum(entries)).toEqual({
      total: 1,
      byKind: [{ kind: "logro", count: 1 }],
      firstAtMs: 7,
      lastAtMs: 7,
    });
  });

  it("trims surrounding whitespace before tallying kinds", () => {
    const entries: readonly SeasonAlbumEntry[] = [
      { kind: " logro ", title: "A", atMs: 1 },
      { kind: "logro", title: "B", atMs: 2 },
    ];
    expect(buildSeasonAlbum(entries)).toEqual({
      total: 2,
      byKind: [{ kind: "logro", count: 2 }],
      firstAtMs: 1,
      lastAtMs: 2,
    });
  });

  it("breaks count ties by kind ascending", () => {
    const entries: readonly SeasonAlbumEntry[] = [
      { kind: "zeta", title: "Z", atMs: 1 },
      { kind: "alfa", title: "A", atMs: 2 },
      { kind: "beta", title: "B", atMs: 3 },
    ];
    const album = buildSeasonAlbum(entries);
    expect(album.byKind).toEqual([
      { kind: "alfa", count: 1 },
      { kind: "beta", count: 1 },
      { kind: "zeta", count: 1 },
    ]);
  });

  it("computes the span from unordered timestamps", () => {
    const entries: readonly SeasonAlbumEntry[] = [
      { kind: "evento", title: "Medio", atMs: 500 },
      { kind: "evento", title: "Tarde", atMs: 900 },
      { kind: "evento", title: "Pronto", atMs: 100 },
    ];
    const album = buildSeasonAlbum(entries);
    expect(album.firstAtMs).toBe(100);
    expect(album.lastAtMs).toBe(900);
    expect(album.total).toBe(3);
  });

  it("is deterministic and order-independent for the tally", () => {
    const a: readonly SeasonAlbumEntry[] = [
      { kind: "logro", title: "1", atMs: 1 },
      { kind: "evento", title: "2", atMs: 2 },
      { kind: "logro", title: "3", atMs: 3 },
    ];
    const b: readonly SeasonAlbumEntry[] = [
      { kind: "logro", title: "3", atMs: 3 },
      { kind: "logro", title: "1", atMs: 1 },
      { kind: "evento", title: "2", atMs: 2 },
    ];
    const first = buildSeasonAlbum(a);
    expect(buildSeasonAlbum(a)).toEqual(first);
    expect(buildSeasonAlbum(b).byKind).toEqual(first.byKind);
  });

  it("handles negative and zero timestamps for the span", () => {
    const entries: readonly SeasonAlbumEntry[] = [
      { kind: "momento", title: "Antes", atMs: -50 },
      { kind: "momento", title: "Cero", atMs: 0 },
    ];
    expect(buildSeasonAlbum(entries)).toEqual({
      total: 2,
      byKind: [{ kind: "momento", count: 2 }],
      firstAtMs: -50,
      lastAtMs: 0,
    });
  });
});
