/**
 * El bicho que se pone contento cuando a su dueño le dan las gracias.
 *
 * Es el efecto declarado del perro (`animoPorGratitud`), y es el unico del
 * catalogo que conecta la mascota con como te trata el grupo en vez de con lo
 * que tu haces. Estuvo escrito en su ficha desde el primer dia sin que pasara
 * nada.
 *
 * Vive fuera de `bot-update.service.ts` porque el nucleo solo puede encoger, y
 * porque asi se prueba suelto: aqui hay reloj inyectado y ni una lectura de
 * `Date.now()`.
 *
 * **Sube el animo sobre el estado YA envejecido.** Sumarle al que hay guardado
 * le regalaria las horas que lleva sin mirarse, que es el mismo error que
 * evita `/jugar` y por el mismo motivo.
 *
 * No tiene guarda de una vez al dia, y es a proposito: la gratitud ya la acota
 * su propio sistema —hay que responder a alguien y no puedes darte las gracias
 * a ti mismo— y el animo tiene tope. Lo peor que puede pasar es que a alguien
 * muy agradecido se le ponga el bicho contento, que es exactamente lo que
 * promete la ficha.
 */

import type { PetRepository } from "@superbot/data";
import {
  aplicarPasoDelTiempo,
  esRasgoId,
  MAXIMO,
  type RasgoId,
  ventajasDe,
} from "@superbot/module-games";

export const animarPorGratitud = async (input: {
  readonly mascotas: PetRepository;
  readonly tenantId: string;
  readonly chatId: string;
  /** Quien RECIBE las gracias: es su bicho el que se alegra. */
  readonly usuario: bigint;
  readonly ahora: Date;
}): Promise<void> => {
  const { mascotas, tenantId, chatId, usuario, ahora } = input;

  const fila = await mascotas
    .obtener(tenantId, chatId, usuario)
    .catch(() => null);
  if (!fila) {
    return;
  }

  const sube = ventajasDe(fila.especie).animoPorGracias;
  if (sube <= 0) {
    return;
  }

  const rasgos = fila.rasgos.filter((id): id is RasgoId => esRasgoId(id));
  const envejecida = aplicarPasoDelTiempo(
    { hambre: fila.hambre, animo: fila.animo, nivel: fila.nivel, xp: fila.xp },
    ahora.getTime() - fila.vistaEn.getTime(),
    rasgos,
  );

  await mascotas
    .guardarEstado(fila.id, {
      ...envejecida,
      animo: Math.min(MAXIMO, envejecida.animo + sube),
      vistaEn: ahora,
    })
    // Que no se alegre el bicho no puede impedir que se registren las gracias:
    // lo que la persona pidio fue agradecer, y eso ya esta hecho.
    .catch(() => undefined);
};
