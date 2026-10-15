/**
 * Lo que hacen las mascotas DESPUES de un robo con exito.
 *
 * Dos efectos que no caben en `resolveSteal` porque no deciden el robo: uno
 * apunta una deuda que se paga dias despues y el otro mueve objetos entre
 * inventarios. El motor decide y no toca ni la base de datos ni el cajon, asi
 * que esto vive aqui.
 *
 * Fuera de `bot-update.service.ts` porque el nucleo solo puede encoger. Alli
 * queda una llamada.
 *
 * **Nada de esto puede tumbar el robo.** Cuando se llega aqui, el botin ya se
 * ha movido: fallar ahora y propagar el error dejaria a alguien robado y sin
 * mensaje, y al reintentarse el update, robado dos veces. Por eso las dos
 * mitades se tragan sus fallos por separado.
 */

import type { InventoryRepository, PetRepository } from "@superbot/data";
import { ventajasDe } from "@superbot/module-games";

export interface BotinDeMascota {
  /** Objeto que el bicho del ladron se ha llevado ademas del dinero. */
  readonly objeto: string | null;
}

export const trasUnRoboConExito = async (input: {
  readonly mascotas: PetRepository;
  readonly inventario: InventoryRepository;
  readonly tenantId: string;
  readonly chatId: string;
  readonly ladron: bigint;
  readonly victima: bigint;
  /** Lo que se ha llevado, para que pueda volver poco a poco. */
  readonly botin: number;
  /** Tirada ya sorteada, en [0,1). */
  readonly tirada: number;
  readonly nowMs: number;
}): Promise<BotinDeMascota> => {
  const {
    mascotas,
    inventario,
    tenantId,
    chatId,
    ladron,
    victima,
    botin,
    tirada,
    nowMs,
  } = input;

  // El caracol (`recuperaRobado`) necesita saber CUANTO le quitaron: sin este
  // apunte, "lo robado vuelve solo" no tendria de donde sacar la cifra. Se
  // apunta siempre y el barrido ya mira si la especie sabe recuperarlo — al
  // reves habria que leer la mascota de la victima aqui, en el camino caliente
  // de cada robo.
  await mascotas
    .apuntarRobado(tenantId, chatId, victima, botin)
    .catch(() => undefined);

  const bicho = await mascotas
    .obtener(tenantId, chatId, ladron)
    .catch(() => null);
  const probabilidad = ventajasDe(bicho?.especie).robo.robaObjetos;
  // `<` y no `<=`, como en el resto: con probabilidad 0 y tirada 0, un `<=`
  // robaria un objeto en todos los golpes de todo el mundo.
  if (!(probabilidad > 0) || !(tirada < probabilidad)) {
    return { objeto: null };
  }

  const suyos = await inventario
    .list(tenantId, chatId, victima)
    .catch(() => []);
  const primero = suyos.find((item) => item.itemId);
  if (!primero) {
    return { objeto: null };
  }

  // Quitar y dar, en ese orden. Al reves —dar primero— un fallo al quitar
  // duplicaria el objeto, que es peor que perderlo: uno es un robo que no
  // ocurre y el otro es fabricar objetos de la nada.
  const quitado = await inventario
    .consume({
      tenantId,
      chatId,
      userTelegramId: victima,
      itemId: primero.itemId,
      nowMs,
    })
    .catch(() => ({ ok: false, remaining: 0 }));
  if (!quitado.ok) {
    return { objeto: null };
  }

  await inventario
    .grant({
      tenantId,
      chatId,
      userTelegramId: ladron,
      itemId: primero.itemId,
      addUses: 1,
      nowMs,
    })
    .catch(() => undefined);

  return { objeto: primero.itemId };
};
