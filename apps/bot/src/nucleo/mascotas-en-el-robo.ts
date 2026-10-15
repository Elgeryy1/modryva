/**
 * Busca los bichos de las dos partes de un robo y traduce lo que aportan.
 *
 * Vive fuera de `bot-update.service.ts` a proposito: el nucleo solo puede
 * encoger, y todo lo que se pueda escribir aqui es tamaño que no se le suma.
 * Alli queda una llamada; la decision de que aporta cada especie ya vivia en
 * el modulo y lo unico que faltaba era ir a buscarla.
 *
 * Las dos consultas van **en paralelo** y con red debajo: un fallo al leer las
 * mascotas no puede impedir un robo. Sin bicho el resultado es un objeto
 * vacio, que es exactamente lo que habia antes de que las mascotas existieran.
 */

import type { PetRepository } from "@superbot/data";
import {
  fusionarModificadores,
  modificadoresDeRoboPorMascota,
  type StealModifiers,
  ventajasDe,
} from "@superbot/module-games";

export const modificadoresDeRoboDeLasMascotas = async (input: {
  readonly mascotas: PetRepository;
  readonly tenantId: string;
  readonly chatId: string;
  readonly ladron: bigint;
  readonly victima: bigint;
}): Promise<StealModifiers> => {
  const { mascotas, tenantId, chatId, ladron, victima } = input;

  // `catch(() => null)` en cada una por separado y no un try alrededor de las
  // dos: si falla la del ladron, la de la victima todavia puede defenderla.
  // Con un solo try, una lectura rota le quitaria el escudo a alguien que si
  // lo tiene.
  const [deQuienRoba, deLaVictima, guardaespaldas] = await Promise.all([
    mascotas.obtener(tenantId, chatId, ladron).catch(() => null),
    mascotas.obtener(tenantId, chatId, victima).catch(() => null),
    // El castor (`protegeAOtro`) cubre a alguien que no es su dueño. Se busca
    // por `protegeA`, que tiene indice: esto corre en CADA robo.
    mascotas.quienProtegeA(tenantId, chatId, victima).catch(() => null),
  ]);

  const propios = modificadoresDeRoboPorMascota({
    deQuienRoba: deQuienRoba?.especie ?? null,
    deLaVictima: deLaVictima?.especie ?? null,
  });

  // Lo que aporta el guardaespaldas se SUMA al escudo propio de la victima, no
  // lo sustituye: quien tiene tortuga y ademas un amigo con castor esta mejor
  // protegido que con cualquiera de los dos, que es lo que hace que proteger a
  // alguien signifique algo.
  //
  // Y se ignora si el guardaespaldas es la propia victima: `/proteger` a uno
  // mismo doblaria el escudo gratis, y ahi el bono ya lo cobro `propios`.
  const cubre =
    guardaespaldas?.userTelegramId === victima
      ? 0
      : ventajasDe(guardaespaldas?.especie).robo.protegeAOtro;
  if (cubre <= 0) {
    return propios;
  }

  return fusionarModificadores(propios, {
    victimGuardPct: Math.round(cubre * 100),
  });
};

/**
 * Si el bicho de quien acaba de fallar le salva el objeto que uso.
 *
 * Es el efecto de la serpiente (`ahorraObjeto`). Solo decide: devolver el
 * objeto al cajon es de quien tiene el inventario, que es el nucleo.
 *
 * **La tirada entra por parametro y ya sorteada.** Sin eso no se puede probar
 * "le ha salvado" contra "no le ha salvado" sin repetir el test hasta que
 * salga lo que interesa, que es como se escriben los tests que no fallan
 * nunca.
 *
 * Quien no tiene bicho, o lo tiene sin ese efecto, siempre pierde el objeto —
 * que es lo que pasaba antes de que las mascotas existieran.
 */
export const salvaElObjetoAlFallar = async (input: {
  readonly mascotas: PetRepository;
  readonly tenantId: string;
  readonly chatId: string;
  readonly ladron: bigint;
  /** Tirada ya sorteada, en [0,1). */
  readonly tirada: number;
}): Promise<boolean> => {
  const { mascotas, tenantId, chatId, ladron, tirada } = input;

  const fila = await mascotas
    .obtener(tenantId, chatId, ladron)
    .catch(() => null);
  if (!fila) {
    return false;
  }

  const probabilidad = ventajasDe(fila.especie).robo.ahorraObjeto;
  // `<` y no `<=`: con probabilidad 0 y una tirada de 0, un `<=` salvaria el
  // objeto de todo el mundo. Es el error clasico del umbral y aqui se notaria
  // como "los objetos no se gastan nunca".
  return probabilidad > 0 && tirada < probabilidad;
};
