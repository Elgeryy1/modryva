import { describe, expect, it } from "vitest";
import { roleCopyOf } from "./impostor-role";

describe("lo que ve cada rol en El Impostor", () => {
  const impostor = roleCopyOf("impostor");
  const grupo = roleCopyOf("crew");

  it("al impostor se le dice que lo es, y en el titular", () => {
    // El fallo original: el rol llegaba bien pero se contaba en letra pequeña
    // al final, debajo de la palabra en cuerpo enorme. Nadie lo leia.
    expect(impostor.headline).toContain("IMPOSTOR");
    expect(grupo.headline).not.toContain("IMPOSTOR");
  });

  it("las dos pantallas NO se parecen en nada de lo que se lee primero", () => {
    // Esta es la propiedad que fallaba, y por eso se comprueba entera en vez
    // de mirar solo una frase: si algun dia vuelven a converger, salta.
    expect(impostor.kind).not.toBe(grupo.kind);
    expect(impostor.caption).not.toBe(grupo.caption);
    expect(impostor.headline).not.toBe(grupo.headline);
    expect(impostor.wordLabel).not.toBe(grupo.wordLabel);
    expect(impostor.hint).not.toBe(grupo.hint);
  });

  it("al impostor se le avisa de que su palabra no es la del grupo", () => {
    // Sin esto, da una pista de su palabra creyendo que es la comun y cae en
    // la primera ronda sin haber jugado.
    expect(impostor.wordLabel.toLowerCase()).toContain("no es");
  });

  it("ante la duda, se trata como del grupo", () => {
    // Decirle "eres el impostor" a quien no lo es arruina la partida entera;
    // lo contrario no cuesta nada.
    for (const raro of [undefined, "", "IMPOSTOR", "crew", "otra cosa"]) {
      expect(roleCopyOf(raro).headline).toBe(
        raro === "impostor" ? impostor.headline : grupo.headline,
      );
    }
  });
});
