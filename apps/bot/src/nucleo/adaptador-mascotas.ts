/**
 * El adaptador de mascotas: traduce entre la base de datos y el modulo.
 *
 * Vive fuera de `bot-update.service.ts` a proposito. El nucleo solo puede
 * encoger, y todo lo que se pueda escribir aqui es tamaño que no se le suma —
 * ademas de que un adaptador suelto se prueba solo, sin arrancar el servicio.
 *
 * Hace tres cosas que el modulo no puede hacer por si mismo:
 *
 * 1. **Aplica el paso del tiempo al leer.** El decay no se guarda tick a tick:
 *    se calcula al mirar la mascota. Sin esto, `/mascota` enseñaria el hambre
 *    que tenia la ultima vez que paso el worker, que puede ser de hace un rato.
 * 2. **Resuelve el dia UTC** para el contador de raciones. Un contador sin su
 *    dia no se distingue de uno viejo.
 * 3. **Traduce la fila a la forma del modulo**. Ese renombrado es justo lo que
 *    impide que el modulo sepa que existe Prisma.
 *
 * Se construye con sus dependencias, no leyendolas de un servicio: asi se
 * prueba suelto.
 */

import type {
  EconomyRepository,
  PetRepository,
  PetState,
} from "@superbot/data";
import type {
  EntradaDeCorral,
  MascotaVista,
  PuertoDeMascotas,
  SalidaDeHuevo,
  SalidaDeJuego,
  SalidaDeOperacion,
  SalidaDeProteger,
  SalidaDeRacion,
  SaludDeMascota,
} from "@superbot/module-games";
import {
  type AjustesDeMascotas,
  abrirHuevo,
  alimentar,
  animoTrasJugar,
  aplicarPasoDelTiempo,
  commit,
  decidirOperacion,
  type EspecieId,
  esEspecieId,
  esRasgoId,
  estadoDeSalud,
  msDeDuelo,
  msHastaElPlazo,
  newServerSeed,
  type RasgoId,
  sumarXp,
  ventajasDe,
  XP_POR_JUEGO,
  XP_POR_RACION,
} from "@superbot/module-games";

export interface DependenciasDeMascotas {
  readonly mascotas: PetRepository;
  readonly economia: EconomyRepository;
  readonly tenantId: string;
  readonly chatId: string;
  readonly usuario: bigint;
  readonly ajustes: AjustesDeMascotas;
  /** El reloj, inyectado. Aqui no hay `new Date()`. */
  readonly ahora: Date;
}

/** El dia UTC en texto, igual que lo calcula el tick del worker. */
export const diaUtc = (fecha: Date): string => fecha.toISOString().slice(0, 10);

/**
 * La ficha clinica de una fila, traducida a la forma del modulo.
 *
 * Devuelve `null` para una mascota sana, que es lo que son todas menos las que
 * alguien haya enfermado a mano. El renombrado —`curaCoste` a `coste`, las
 * fechas a milisegundos que quedan— es justo lo que impide que el modulo sepa
 * que existe Prisma: ahi dentro no hay fechas absolutas, solo cuanto falta.
 */
const aSalud = (
  fila: PetState,
  ahora: Date,
  horasDeDuelo: number,
): SaludDeMascota | null => {
  const estado = estadoDeSalud(fila, ahora);
  if (estado === "sana") {
    return null;
  }
  return {
    estado,
    motivo: fila.enfermaMotivo,
    coste: fila.curaCoste ?? 0,
    resto: fila.curaResto ?? 0,
    msQueQuedan: msHastaElPlazo(fila, ahora),
    msDeDuelo: msDeDuelo(fila, horasDeDuelo, ahora),
  };
};

/** Solo los rasgos que el catalogo conoce hoy. */
const rasgosConocidos = (crudos: readonly string[]): readonly RasgoId[] =>
  crudos.filter((id): id is RasgoId => esRasgoId(id));

/**
 * Convierte una fila en lo que ve el modulo, con el tiempo ya aplicado.
 *
 * Devuelve `null` si la especie ya no existe en el catalogo: es preferible
 * decir "no tienes bicho" a enseñar una ficha de algo que el motor no sabe
 * calcular. No deberia pasar nunca, pero el catalogo crece por tandas y una
 * tanda retirada dejaria filas huerfanas.
 */
export const aVista = (
  fila: PetState,
  ahora: Date,
  horasDeDuelo = 0,
): (MascotaVista & { readonly especieId: EspecieId }) | null => {
  if (!esEspecieId(fila.especie)) {
    return null;
  }
  const rasgos = rasgosConocidos(fila.rasgos);
  const conElTiempo = aplicarPasoDelTiempo(
    { hambre: fila.hambre, animo: fila.animo, nivel: fila.nivel, xp: fila.xp },
    ahora.getTime() - fila.vistaEn.getTime(),
    rasgos,
  );
  return {
    especieId: fila.especie,
    especie: fila.especie,
    rasgos,
    nombre: fila.nombre,
    hambre: conElTiempo.hambre,
    animo: conElTiempo.animo,
    nivel: conElTiempo.nivel,
    xp: conElTiempo.xp,
    // El contador solo cuenta si es de hoy. Uno de ayer es cero raciones.
    racionesHoy: fila.racionesDia === diaUtc(ahora) ? fila.racionesHoy : 0,
    regalada: fila.regalada,
    salud: aSalud(fila, ahora, horasDeDuelo),
  };
};

export const crearAdaptadorDeMascotas = (
  dependencias: DependenciasDeMascotas,
): PuertoDeMascotas => {
  const { mascotas, economia, tenantId, chatId, usuario, ajustes, ahora } =
    dependencias;

  const mia = async () => mascotas.obtener(tenantId, chatId, usuario);

  return {
    async mia(): Promise<MascotaVista | null> {
      const fila = await mia();
      return fila ? aVista(fila, ahora, ajustes.horasDeDuelo) : null;
    },

    async deOtro(otro: bigint): Promise<MascotaVista | null> {
      const fila = await mascotas.obtener(tenantId, chatId, otro);
      return fila ? aVista(fila, ahora, ajustes.horasDeDuelo) : null;
    },

    async corral(limite: number): Promise<readonly EntradaDeCorral[]> {
      const filas = await mascotas.corral(tenantId, chatId, limite);
      return filas.flatMap((fila) => {
        const vista = aVista(fila, ahora);
        return vista
          ? [
              {
                usuario: fila.userTelegramId,
                especie: vista.especieId,
                nombre: vista.nombre,
                nivel: vista.nivel,
                hambre: vista.hambre,
                regalada: vista.regalada,
                ...(vista.salud ? { estadoDeSalud: vista.salud.estado } : {}),
              },
            ]
          : [];
      });
    },

    async saldo(): Promise<number> {
      const cartera = await economia.getWallet(tenantId, chatId, usuario);
      return cartera?.balance ?? 0;
    },

    async nombrar(nombre: string): Promise<boolean> {
      const fila = await mia();
      return fila ? mascotas.nombrar(fila.id, nombre) : false;
    },

    async proteger(objetivo: bigint | null): Promise<SalidaDeProteger> {
      const fila = await mia();
      if (!fila) {
        return { ok: false, motivo: "sinMascota" };
      }
      // Protegerse a uno mismo no hace nada —su bono propio ya lo cobra la
      // rama de la victima— asi que se dice en vez de guardarlo y dejar que la
      // persona crea que tiene doble escudo.
      if (objetivo !== null && objetivo === usuario) {
        return { ok: false, motivo: "aTiMismo" };
      }
      // Quien comprueba la especie es el adaptador: es quien tiene la fila y
      // por tanto quien sabe de que bicho se habla. Retirar la proteccion
      // (`null`) se permite siempre, aunque la especie no sepa proteger: si no,
      // cambiar de bicho dejaria una proteccion vieja imposible de quitar.
      if (
        objetivo !== null &&
        ventajasDe(fila.especie).robo.protegeAOtro <= 0
      ) {
        return { ok: false, motivo: "noSabeProteger" };
      }
      const puesto = await mascotas.protegerA(fila.id, objetivo);
      return puesto
        ? { ok: true, objetivo }
        : { ok: false, motivo: "sinMascota" };
    },

    async jugar(): Promise<SalidaDeJuego> {
      const fila = await mia();
      if (!fila) {
        return { ok: false, motivo: "sinMascota" };
      }
      // El animo se calcula sobre el estado YA envejecido: sumarle quince al
      // que hay guardado le regalaria las horas que lleva sin mirarse.
      const vista = aVista(fila, ahora);
      if (!vista) {
        return { ok: false, motivo: "sinMascota" };
      }
      const antes = vista.animo;
      // La XP se calcula ANTES de escribir y con el estado ya envejecido. El
      // repositorio la mete en el mismo `updateMany` que la marca del dia, asi
      // que si ya se habia jugado hoy no se suma: jugar es una vez al dia y su
      // XP tambien.
      const subida = sumarXp(vista, XP_POR_JUEGO);
      const jugado = await mascotas.jugar({
        id: fila.id,
        animoNuevo: animoTrasJugar(antes),
        xpNueva: subida.estado.xp,
        nivelNuevo: subida.nivel,
        diaUtc: diaUtc(ahora),
      });
      return jugado.ok
        ? {
            ok: true,
            animo: jugado.animo,
            subida: jugado.animo - antes,
            progreso: {
              xpGanada: subida.ganada,
              nivel: subida.nivel,
              haSubido: subida.haSubido,
              evoluciona: subida.evoluciona,
            },
          }
        : { ok: false, motivo: "yaHoy" };
    },

    async alimentar(): Promise<SalidaDeRacion> {
      const fila = await mia();
      const vista = fila ? aVista(fila, ahora) : null;
      if (!fila || !vista) {
        return { ok: false, motivo: "yaLlena", coste: 0, saldo: 0 };
      }

      const cartera = await economia.getWallet(tenantId, chatId, usuario);
      const saldo = cartera?.balance ?? 0;

      // La DECISION la toma el modulo, con el estado ya envejecido. Aqui solo
      // se ejecuta lo que decida.
      const decision = alimentar({
        estado: vista,
        saldo,
        racionesHoy: vista.racionesHoy,
        rasgos: vista.rasgos,
        precioRacion: ajustes.precioRacion,
        racionesPorDia: ajustes.racionesPorDia,
      });

      if (!decision.ok) {
        return {
          ok: false,
          motivo: decision.motivo,
          coste: decision.coste,
          saldo,
        };
      }

      // La XP de la racion se calcula sobre el estado que deja la racion. El
      // tope de raciones del grupo ya acota cuantas veces al dia puede sumar,
      // asi que no hace falta una guarda propia: quien no puede comer mas
      // tampoco llega hasta aqui.
      const subida = sumarXp(decision.estado, XP_POR_RACION);

      const servida = await mascotas.servirRacion({
        id: fila.id,
        tenantId,
        chatId,
        userTelegramId: usuario,
        coste: decision.coste,
        hambreNueva: decision.estado.hambre,
        xpNueva: subida.estado.xp,
        nivelNuevo: subida.nivel,
        diaUtc: diaUtc(ahora),
      });

      // La carrera existe: entre leer el saldo y cobrarlo puede haberse ido en
      // otra cosa. La base de datos es quien manda, y por eso el resultado sale
      // de ella y no de la decision.
      if (!servida.ok) {
        return {
          ok: false,
          motivo: "sinSaldo",
          coste: decision.coste,
          saldo: servida.saldo,
        };
      }
      return {
        ok: true,
        coste: decision.coste,
        hambre: decision.estado.hambre,
        progreso: {
          xpGanada: subida.ganada,
          nivel: subida.nivel,
          haSubido: subida.haSubido,
          evoluciona: subida.evoluciona,
        },
      };
    },

    async operar(): Promise<SalidaDeOperacion> {
      const fila = await mia();
      if (!fila) {
        return { ok: false, motivo: "sinMascota", coste: 0, saldo: 0 };
      }

      const cartera = await economia.getWallet(tenantId, chatId, usuario);
      const saldo = cartera?.balance ?? 0;

      // La DECISION la toma el modulo. Aqui solo se ejecuta lo que decida, y lo
      // unico que se pone de mas es la atomicidad, que no la puede dar ningun
      // modulo porque la garantiza la base de datos.
      const decision = decidirOperacion({ ficha: fila, saldo, ahora });
      if (!decision.ok) {
        return {
          ok: false,
          motivo: decision.motivo,
          coste: decision.coste,
          saldo: decision.saldo,
        };
      }

      const hecha = await mascotas.operar({
        id: fila.id,
        tenantId,
        chatId,
        userTelegramId: usuario,
        aPagar: decision.aPagar,
        resto: decision.resto,
        // El `refId` identifica ESTA enfermedad, no esta mascota: lleva la
        // fecha del diagnostico. Con solo el id, la segunda enfermedad de su
        // vida chocaria con el apunte de la primera y saldria gratis.
        refId: `${fila.id}:${fila.enfermaDesde?.toISOString() ?? ""}`,
      });

      // La carrera existe: entre leer el saldo y cobrarlo puede haberse ido en
      // una apuesta. La base de datos es quien manda, y por eso el resultado
      // sale de ella y no de la decision.
      return hecha.ok
        ? { ok: true, pagado: hecha.pagado, saldo: hecha.saldo }
        : {
            ok: false,
            // El repositorio dice `sinSaldo` y el modulo dice `noLlega`: son lo
            // mismo visto desde fuera, y traducir entre los dos vocabularios es
            // exactamente para lo que existe este adaptador.
            motivo: hecha.motivo === "sinSaldo" ? "noLlega" : hecha.motivo,
            coste: fila.curaCoste ?? 0,
            saldo: hecha.saldo,
          };
    },

    async nacer(): Promise<SalidaDeHuevo> {
      const yaTiene = await mia();
      if (yaTiene) {
        return { ok: false, motivo: "yaTiene", precio: 0, saldo: 0 };
      }

      const cartera = await economia.getWallet(tenantId, chatId, usuario);
      const saldo = cartera?.balance ?? 0;

      // El primero es gratis. Tres mil monedas es una barrera alta para quien
      // acaba de enterarse de que esto existe, y sin el regalo la feature solo
      // la ve quien ya tenia saldo — justo a quien menos falta le hace una
      // razon para volver.
      const esElPrimero = ajustes.primerHuevoGratis;
      const precio = esElPrimero ? 0 : ajustes.precioHuevo;

      if (precio > 0 && saldo < precio) {
        return { ok: false, motivo: "sinSaldo", precio, saldo };
      }

      // Commit-reveal, igual que el casino. La semilla se genera aqui y se
      // guarda con su hash: cualquiera puede recomputar que especie le toco.
      const serverSeed = newServerSeed();
      const eclosion = abrirHuevo({
        tipo: "basico",
        serverSeed,
        clientSeed: `${usuario}`,
        nonce: 0,
      });
      if (!eclosion) {
        return { ok: false, motivo: "sinSaldo", precio, saldo };
      }

      if (precio > 0) {
        const cobro = await economia.debit(
          tenantId,
          chatId,
          usuario,
          precio,
          "pet-egg",
        );
        if (!cobro.ok) {
          return {
            ok: false,
            motivo: "sinSaldo",
            precio,
            saldo: cobro.balance,
          };
        }
      }

      await mascotas.crear({
        tenantId,
        chatId,
        userTelegramId: usuario,
        especie: eclosion.especie,
        rasgos: eclosion.rasgos,
        ahora,
        serverSeed,
        serverSeedHash: commit(serverSeed),
        clientSeed: `${usuario}`,
      });

      return { ok: true, especie: eclosion.especie, gratis: precio === 0 };
    },
  };
};
