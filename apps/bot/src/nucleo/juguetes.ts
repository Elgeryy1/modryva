/**
 * Comprar un juguete y darselo a la mascota.
 *
 * La decision —cuanto animo da, si cabe, si queda cupo hoy— es pura y vive en
 * `modules/games/src/pets/juguetes.ts`. Aqui esta lo que un modulo no puede
 * hacer: leer la fila, envejecerla y escribir.
 *
 * Vive fuera de `bot-update.service.ts` porque el nucleo esta en su tope y
 * esto es traduccion: coger un id de la tienda, mirar la mascota y contar el
 * resultado. La misma pareja decision/orquestacion que las sanciones a admins.
 *
 * ## El animo se calcula sobre el estado ENVEJECIDO
 *
 * Sumarle los puntos al valor guardado le regalaria las horas que la mascota
 * lleva sin mirarse. La fila solo se pone al dia cuando pasa el barrido, y
 * entre barrido y barrido hay quince minutos.
 */

import type { PetRepository } from "@superbot/data";
import {
  aplicarPasoDelTiempo,
  esRasgoId,
  JUGUETES_POR_DIA,
  type Juguete,
  type RasgoId,
  usarJuguete,
} from "@superbot/module-games";

/**
 * Como acabo la compra.
 *
 * `sinMascota`, `topeDiario` y `yaLlena` son los tres motivos por los que hay
 * que DEVOLVER el dinero: en ninguno de ellos la mascota recibe nada, y cobrar
 * por lo que no pasa es la mentira que este repo persigue en todas partes.
 */
export type ResultadoDeJuguete =
  | { readonly ok: true; readonly animo: number; readonly subida: number }
  | {
      readonly ok: false;
      readonly motivo: "sinMascota" | "topeDiario" | "yaLlena";
    };

export const darJuguete = async ({
  mascotas,
  juguete,
  tenantId,
  chatId,
  usuario,
  ahora,
  topeDiario = JUGUETES_POR_DIA,
}: {
  readonly mascotas: PetRepository;
  readonly juguete: Juguete;
  readonly tenantId: string;
  readonly chatId: string;
  readonly usuario: bigint;
  readonly ahora: Date;
  readonly topeDiario?: number;
}): Promise<ResultadoDeJuguete> => {
  const fila = await mascotas.obtener(tenantId, chatId, usuario);
  if (!fila) {
    return { ok: false, motivo: "sinMascota" };
  }

  const dia = ahora.toISOString().slice(0, 10);
  const rasgos = fila.rasgos.filter((id): id is RasgoId => esRasgoId(id));
  const estado = aplicarPasoDelTiempo(
    { hambre: fila.hambre, animo: fila.animo, nivel: fila.nivel, xp: fila.xp },
    ahora.getTime() - fila.vistaEn.getTime(),
    rasgos,
  );

  const decision = usarJuguete({
    juguete,
    animo: estado.animo,
    usadosHoy: fila.juguetesDia === dia ? fila.juguetesHoy : 0,
    topeDiario,
  });
  if (!decision.ok) {
    return { ok: false, motivo: decision.motivo };
  }

  // El tope se vuelve a comprobar DENTRO de la transaccion del repositorio:
  // entre la decision de arriba y esta escritura cabe otra compra, y sin esa
  // segunda guarda dos a la vez se saltarian el limite.
  const gastado = await mascotas.usarJuguete({
    id: fila.id,
    animoNuevo: decision.animo,
    diaUtc: dia,
    topeDiario,
  });
  return gastado.ok
    ? { ok: true, animo: gastado.animo, subida: decision.subida }
    : { ok: false, motivo: "topeDiario" };
};

/** Lo que se le dice a quien acaba de comprarlo. */
export const textoDeJuguete = (
  juguete: Juguete,
  resultado: ResultadoDeJuguete,
): string => {
  if (resultado.ok) {
    return [
      `${juguete.icono} Le has dado ${juguete.nombre.toLowerCase()}. Ánimo +${Math.round(resultado.subida)} → ${Math.round(resultado.animo)}/100.`,
      "Un bicho contento rinde más.",
    ].join("\n");
  }
  if (resultado.motivo === "sinMascota") {
    return "No tienes bicho al que dárselo. El primero es gratis: /huevo";
  }
  if (resultado.motivo === "yaLlena") {
    return "Ya está por las nubes. Guárdate las monedas para mañana.";
  }
  return `Ya ha jugado bastante por hoy (${JUGUETES_POR_DIA} juguetes al día). Mañana más.`;
};
