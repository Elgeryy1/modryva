import { describe, expect, it } from "vitest";
import {
  matchStickerBlocklist,
  normalizeStickerBlocklist,
  type StickerRef,
} from "./sticker-blocklist.js";

const sticker = (overrides: StickerRef = {}): StickerRef => ({ ...overrides });

describe("normalizeStickerBlocklist", () => {
  it("recorta y minusculiza las entradas", () => {
    expect(normalizeStickerBlocklist(["  BadPack  ", "OtroSet"])).toEqual([
      "badpack",
      "otroset",
    ]);
  });

  it("descarta cadenas vacias y solo-espacios", () => {
    expect(normalizeStickerBlocklist(["", "   ", "ok"])).toEqual(["ok"]);
  });

  it("elimina duplicados preservando el primer orden", () => {
    expect(
      normalizeStickerBlocklist(["Pack", "pack", "PACK ", "otro"]),
    ).toEqual(["pack", "otro"]);
  });

  it("devuelve vacio para lista vacia", () => {
    expect(normalizeStickerBlocklist([])).toEqual([]);
  });
});

describe("matchStickerBlocklist", () => {
  it("bloquea por setName exacto", () => {
    expect(
      matchStickerBlocklist(sticker({ setName: "nsfw_pack" }), ["nsfw_pack"]),
    ).toEqual({
      blocked: true,
      reason: "Pack de stickers bloqueado: nsfw_pack",
    });
  });

  it("bloquea por setName ignorando mayusculas y espacios", () => {
    expect(
      matchStickerBlocklist(sticker({ setName: "  NSFW_Pack " }), [
        "nsfw_pack",
      ]),
    ).toEqual({
      blocked: true,
      reason: "Pack de stickers bloqueado:   NSFW_Pack ",
    });
  });

  it("conserva el setName original (sin normalizar) en el motivo", () => {
    const result = matchStickerBlocklist(sticker({ setName: "SpamSet" }), [
      "spamset",
    ]);
    expect(result.reason).toBe("Pack de stickers bloqueado: SpamSet");
  });

  it("bloquea por fileUniqueId cuando no hay setName", () => {
    expect(
      matchStickerBlocklist(sticker({ fileUniqueId: "AgADabc123" }), [
        "agadabc123",
      ]),
    ).toEqual({ blocked: true, reason: "Sticker bloqueado" });
  });

  it("da prioridad al setName sobre el fileUniqueId", () => {
    const result = matchStickerBlocklist(
      sticker({ setName: "badset", fileUniqueId: "fid1" }),
      ["badset", "fid1"],
    );
    expect(result).toEqual({
      blocked: true,
      reason: "Pack de stickers bloqueado: badset",
    });
  });

  it("cae al fileUniqueId si el setName no esta en la lista", () => {
    expect(
      matchStickerBlocklist(
        sticker({ setName: "good", fileUniqueId: "fid1" }),
        ["fid1"],
      ),
    ).toEqual({ blocked: true, reason: "Sticker bloqueado" });
  });

  it("no bloquea cuando nada coincide", () => {
    expect(
      matchStickerBlocklist(
        sticker({ setName: "clean", fileUniqueId: "abc" }),
        ["otro", "mas"],
      ),
    ).toEqual({ blocked: false });
  });

  it("no incluye reason cuando no bloquea", () => {
    const result = matchStickerBlocklist(sticker({ setName: "clean" }), [
      "sucio",
    ]);
    expect(result).toEqual({ blocked: false });
    expect("reason" in result).toBe(false);
  });

  it("no bloquea con blocklist vacia", () => {
    expect(
      matchStickerBlocklist(sticker({ setName: "cualquiera" }), []),
    ).toEqual({ blocked: false });
  });

  it("no bloquea un sticker sin campos", () => {
    expect(matchStickerBlocklist(sticker(), ["algo"])).toEqual({
      blocked: false,
    });
  });

  it("nunca coincide un setName solo-espacios contra entrada normalizada", () => {
    expect(matchStickerBlocklist(sticker({ setName: "   " }), ["x"])).toEqual({
      blocked: false,
    });
  });

  it("ignora entradas vacias de la blocklist sin bloquear campos vacios", () => {
    expect(
      matchStickerBlocklist(sticker({ fileUniqueId: "" }), ["", "  "]),
    ).toEqual({ blocked: false });
  });

  it("coincide el fileUniqueId ignorando mayusculas", () => {
    expect(
      matchStickerBlocklist(sticker({ fileUniqueId: "FID_XYZ" }), ["fid_xyz"]),
    ).toEqual({ blocked: true, reason: "Sticker bloqueado" });
  });

  it("es determinista para entradas identicas", () => {
    const s = sticker({ setName: "dup", fileUniqueId: "z" });
    const list = ["dup"];
    expect(matchStickerBlocklist(s, list)).toEqual(
      matchStickerBlocklist(s, list),
    );
  });
});
