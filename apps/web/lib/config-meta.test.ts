import {
  decodeStartParam as decodeShared,
  encodeAppointedAdminsStartParam,
  encodeConfigStartParam,
  encodeGamesHubStartParam,
  encodeMatchStartParam,
  encodePetStartParam,
  encodeRosterStartParam,
  encodeShopStartParam,
  ROSTER_ALL_START_PARAM,
} from "@superbot/shared";
import { describe, expect, it } from "vitest";
import { decodeStartParam } from "./config-meta";

/**
 * The web bundle carries its own copy of the startapp codec (see the comment in
 * config-meta.ts) so that @superbot/shared's server dependencies stay out of the
 * browser. A duplicate only stays safe while something proves the two agree —
 * and this one HAD drifted: `bd_all` shipped in shared but not here, so the web
 * decoded it as a group literally named "all" and the API answered 500.
 */
describe("config-meta startapp codec mirrors @superbot/shared", () => {
  const payloads = [
    encodeConfigStartParam("-1009000000001"),
    encodeRosterStartParam("-1009000000001"),
    ROSTER_ALL_START_PARAM,
    encodeAppointedAdminsStartParam("-1009000000001"),
    encodeShopStartParam("-1009000000001"),
    encodePetStartParam("-1009000000001"),
    encodeGamesHubStartParam(),
    encodeGamesHubStartParam("-1009000000001"),
    "onb_-1009000000001",
    "game_trivia_-1009000000001",
    "inline_trivia",
    encodeMatchStartParam("cms6moizb000nuj0z3z31inmf"),
    "m_",
    // Garbage and edge cases must be rejected identically too, or the two
    // copies disagree exactly where a malformed link is most dangerous.
    "bd_",
    "adm_",
    "shop_",
    "",
    "nonsense",
  ];

  for (const payload of payloads) {
    it(`agrees on "${payload}"`, () => {
      expect(decodeStartParam(payload)).toEqual(decodeShared(payload));
    });
  }

  it("reads a match invite as a match, so the group button lands on the board", () => {
    // The bug this pins: the kind decoded fine, but the root page had no branch
    // for it, so the invite opened the app and fell through to the player home.
    // The link looked broken while the match sat there waiting.
    expect(decodeStartParam("m_abc123")).toEqual({
      kind: "match",
      matchId: "abc123",
    });
  });

  it("reads the cross-group roster link as no group, not a group called 'all'", () => {
    expect(decodeStartParam(ROSTER_ALL_START_PARAM)).toEqual({
      kind: "roster",
      groupId: null,
    });
  });

  it("routes the appointed-admins link", () => {
    expect(decodeStartParam("adm_-1009000000001")).toEqual({
      kind: "appointedAdmins",
      groupId: "-1009000000001",
    });
  });
});

describe("chivato: ningún tipo nuevo se queda sin espejo", () => {
  it("la lista de arriba cubre todos los encoders de @superbot/shared", async () => {
    // El comentario de config-meta.ts avisa de que un tipo nuevo tiene que
    // aterrizar en las dos copias, pero nada lo comprobaba: la lista de
    // payloads es a mano, asi que añadir un tipo y olvidarse no rompia nada.
    //
    // Paso de verdad con la tienda: `shop_` se añadio solo a shared, la web lo
    // decodificaba como null y el boton "Abrir la tienda" del anuncio no iba a
    // ninguna parte. Este test fija el conjunto de encoders; si aparece uno
    // nuevo, falla aqui y obliga a mirar las dos copias.
    const shared = await import("@superbot/shared");
    const encoders = Object.keys(shared)
      .filter((k) => /^encode.*StartParam$/u.test(k))
      .sort();

    expect(encoders).toEqual([
      "encodeAppointedAdminsStartParam",
      "encodeConfigStartParam",
      "encodeEconomyStartParam",
      "encodeGameStartParam",
      "encodeGamesHubStartParam",
      "encodeInlineGameStartParam",
      "encodeMatchStartParam",
      "encodeOnboardingStartParam",
      "encodePetStartParam",
      "encodeRosterStartParam",
      "encodeShopStartParam",
    ]);
  });

  it("una mascota se lee como mascota, no como grupo llamado nada", () => {
    // Tercera vez que este chivato hace su trabajo: primero con `bd_all`,
    // luego con `shop_`, ahora con `pet_`. La web lleva su propia copia del
    // codec y sin esta rama el enlace abriria la app y se quedaria en la
    // pantalla de siempre.
    expect(decodeStartParam("pet_-1009000000004")).toEqual({
      kind: "pet",
      groupId: "-1009000000004",
    });
    expect(decodeShared("pet_-1009000000004")).toEqual({
      kind: "pet",
      groupId: "-1009000000004",
    });
  });

  it("una tienda se lee como tienda, para que el botón del anuncio abra algo", () => {
    // El mismo fallo que el de la invitación de partida: el tipo decodificaba
    // bien en shared pero la raíz de la Mini App no tenía rama, asi que el
    // enlace abría la app y se quedaba en la pantalla de siempre.
    expect(decodeStartParam("shop_-1009000000004")).toEqual({
      kind: "shop",
      groupId: "-1009000000004",
    });
  });
});
