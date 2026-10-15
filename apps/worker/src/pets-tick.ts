/**
 * El tick de las mascotas: pasarles el tiempo y pagarles el dia.
 *
 * Es lo que hace que el hambre signifique algo. Sin esto la barra estaria
 * clavada donde la dejo la ultima racion, y todo el diseño de "vuelve mañana"
 * seria decorativo.
 *
 * Hace dos cosas por bicho, en este orden:
 *
 * 1. **Le pasa el tiempo** desde `vistaEn`, con sus rasgos. El decay no se
 *    guarda tick a tick: se calcula al mirarlo. Asi un worker parado media hora
 *    no deja a nadie con el bicho congelado, y el resultado no depende de
 *    cuantas veces se haya ejecutado el barrido.
 * 2. **Le paga el dia**, si toca. El pago lleva el dia UTC en el `refId` del
 *    libro mayor, asi que repetirlo no cobra dos veces — es la propiedad que
 *    impide que reiniciar el worker imprima dinero.
 *
 * El reloj entra por parametro. Es lo que permite probar "cuatro horas
 * despues" y "tres dias despues" sin tocar el reloj del proceso.
 */

import type { PetRepository, PetState } from "@superbot/data";
import {
  aplicarPasoDelTiempo,
  avisosQueTocan,
  cerrarDia,
  ESPECIES,
  type EstadoDeMascota,
  esEspecieId,
  factorDeEspecie,
  parsearAjustes,
  type RasgoId,
  rachaTrasCerrar,
  rendimientoDelDia,
  tocaFallecer,
  ventajasDe,
} from "@superbot/module-games";

/**
 * Cuantas se procesan por barrido.
 *
 * El tick corre cada minuto y el hambre baja 3 puntos por hora: hay horas de
 * holgura, asi que da igual que un grupo se procese cuarenta segundos tarde. Un
 * lote acotado es lo que impide que un despliegue con miles de mascotas se
 * convierta en una consulta que bloquea la base.
 */
export const MASCOTAS_POR_BARRIDO = 200;

/** Cada cuanto se le pasa el tiempo a una mascota. */
export const MINUTOS_ENTRE_REVISIONES = 15;

/**
 * Si a esta hora el grupo considera que es de noche.
 *
 * Vive aqui y no en el modulo porque es una decision de ESTE despliegue: el
 * grupo es español, asi que la franja va en hora peninsular (UTC+2 en verano) y
 * no en UTC. Un modulo no puede saber en que huso vive quien lo usa.
 *
 * De 23:00 a 07:00. Ancha a proposito: la alternativa es que el murcielago
 * rinda de noche solo si el barrido cae dentro de una ventana estrecha, y el
 * barrido revisa cada mascota cada quince minutos.
 */
export const esDeNoche = (fecha: Date): boolean => {
  const horaLocal = (fecha.getUTCHours() + 2) % 24;
  return horaLocal >= 23 || horaLocal < 7;
};

/**
 * Lo que se sabe de un grupo, calculado una vez por grupo y por barrido.
 *
 * Se cachea dentro del barrido porque el lote trae mascotas de varios chats
 * mezcladas y las de un mismo chat comparten respuesta: sin la cache serian
 * dos consultas por mascota en vez de dos por grupo.
 */
interface DatosDelGrupo {
  readonly porEspecie: Readonly<Record<string, number>>;
  readonly diasLimpios: number;
  /**
   * El corral en orden, solo las especies. Lo usa el camaleon.
   *
   * Se guarda la lista ademas del recuento porque copiar al vecino necesita el
   * ORDEN, no cuantas hay de cada una — y la consulta ya se hacia entera para
   * contar, asi que no cuesta una peticion mas.
   */
  readonly corral: readonly string[];
  /** Recien llegados que se han quedado. Enciende al pollito. */
  readonly novatos: number;
}

export interface ContextoDelTick {
  readonly mascotas: PetRepository;
  /** Los ajustes del grupo, ya leidos de `chat_settings`. */
  readonly ajustesDeChat: (
    tenantId: string,
    chatId: string,
  ) => Promise<unknown>;
  readonly ahora: Date;
  /**
   * Cuantas mascotas hay de cada especie en un grupo. Enciende la hormiga.
   *
   * Entra como funcion y no como repositorio para que el barrido siga
   * probandose sin base de datos, igual que `ajustesDeChat`. Opcional: quien
   * no la pase deja a esas especies en su caso base, que es lo que hacian
   * todas hasta ahora.
   */
  readonly especiesDelGrupo?: (
    tenantId: string,
    chatId: string,
  ) => Promise<Readonly<Record<string, number>>>;
  /**
   * El corral en orden, solo las especies. Enciende al camaleon.
   *
   * Va aparte de `especiesDelGrupo` aunque salga de la misma consulta porque
   * son dos preguntas distintas —cuantas hay de cada una, y en que orden
   * estan— y quien no sepa contestar la segunda deja al camaleon en su caso
   * base en vez de quedarse sin la primera.
   */
  readonly corralDelGrupo?: (
    tenantId: string,
    chatId: string,
  ) => Promise<readonly string[]>;
  /**
   * Recien llegados que se han quedado. Enciende al pollito.
   *
   * Lo que cuenta es "se quedaron": quien entro y se fue no es un novato que
   * se quede, y contarlo premiaria justo el trasiego que el grupo no quiere.
   */
  readonly novatosDelGrupo?: (
    tenantId: string,
    chatId: string,
  ) => Promise<number>;
  /** Dias seguidos sin sanciones en el grupo. Enciende la paloma. */
  readonly diasLimpiosDelGrupo?: (
    tenantId: string,
    chatId: string,
  ) => Promise<number>;
  /**
   * Como se anuncia que alguien ha subido de nivel, si es que se anuncia.
   *
   * Entra por parametro y no como gateway para que el barrido siga probandose
   * sin red, igual que `ajustesDeChat`. Recibe **un mensaje por chat con todas
   * las subidas juntas**, no uno por mascota, y eso no es cosmetica: el cierre
   * corre a las dos de la madrugada y en un grupo con cuarenta bichos podrian
   * subir varios a la vez. Cuarenta mensajes seguidos de noche es la misma
   * forma de incidente que los cuatro `@all` sin cooldown del 21 de agosto.
   *
   * Ademas va detras del ajuste `avisos`, que sale apagado.
   */
  readonly anunciar?: (aviso: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly subidas: readonly {
      readonly usuario: bigint;
      readonly especie: string;
      readonly nombre: string | null;
      readonly nivel: number;
      readonly evoluciona: boolean;
    }[];
  }) => Promise<void>;
  /**
   * Como se avisa de una enfermedad grave: los recordatorios y la muerte.
   *
   * Canal propio y **no detras del ajuste `avisos`**, a diferencia de las
   * subidas de nivel. Ese ajuste existe para que un grupo pueda callar el ruido
   * de cuarenta bichos subiendo de nivel de madrugada; esto no es ruido: sin el
   * aviso, la factura y el plazo son una encerrona, y quien pierde la mascota
   * la pierde sin haber tenido ocasion de pagarla.
   *
   * Tampoco hay riesgo de inundacion. Solo hay mascotas enfermas cuando alguien
   * lo ha declarado a mano, una por una: no es un evento que pueda dispararse
   * para trescientas personas a la vez, que es lo que hizo falta acotar en las
   * subidas.
   *
   * Va uno por mascota y no agrupado por chat, por lo mismo: son pocos y cada
   * uno habla de una persona concreta a la que hay que nombrar.
   */
  readonly avisarDeSalud?: (aviso: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly usuario: bigint;
    readonly especie: string;
    readonly nombre: string | null;
    readonly clase: "recordatorio" | "muerte";
    /** Lo que hay que pagar, y hasta cuando. Ausentes en la muerte. */
    readonly coste: number | null;
    readonly vence: Date | null;
    readonly motivo: string | null;
  }) => Promise<void>;
  /** Cuantas mirar como mucho. Para poder probarlo con lotes pequeños. */
  readonly limite?: number;
}

export interface ResumenDelTick {
  readonly miradas: number;
  readonly dormidas: number;
  readonly pagadas: number;
  readonly monedas: number;
  /** Las que subieron de nivel. Se anuncian, pero no desde aqui. */
  readonly subidas: number;
  /** A cuantas les ha vuelto hoy parte de lo que les robaron. */
  readonly recuperadas: number;
  /** Cuanto ha vuelto en total. Separado de `monedas` porque no se acuña
   * igual: el rendimiento crea moneda y esto devuelve la que ya existia. */
  readonly monedasRecuperadas: number;
  /**
   * Cuantas han muerto en este barrido por no operarse a tiempo.
   *
   * Deberia ser cero casi siempre. Si un dia no lo es y nadie ha declarado
   * ninguna enfermedad, hay algo roto de verdad.
   */
  readonly fallecidas: number;
}

/** El dia UTC en texto, que es lo que va al `refId` del libro mayor. */
export const diaUtcDe = (fecha: Date): string =>
  fecha.toISOString().slice(0, 10);

/**
 * Una tirada reproducible para las especies que se juegan la renta.
 *
 * No usa `Math.random()`: sale del id de la mascota y del dia, asi que el
 * resultado del martes es el mismo aunque el tick se repita, y el pago
 * idempotente no puede acabar pagando una cantidad distinta a la que ya se
 * anoto. Es un hash pequeño, no una fuente criptografica — aqui no hace falta,
 * porque el dinero lo acota el tope y el apunte ya esta escrito.
 */
export const tiradaDelDia = (id: string, diaUtc: string): number => {
  const texto = `${id}:${diaUtc}`;
  let hash = 2_166_136_261;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return ((hash >>> 0) % 100_000) / 100_000;
};

/**
 * El factor del bicho que tiene al lado en el corral. Para el camaleon.
 *
 * "Al lado" es el siguiente de la lista, y si es el ultimo, el anterior: en un
 * corral de uno no hay vecino y se queda en su caso base. El orden lo pone el
 * corral (por nivel), asi que el vecino cambia cuando cambia el ranking — que
 * es justo lo que hace interesante a esta especie.
 *
 * **Un camaleon nunca copia a otro camaleon.** Sin ese corte, dos camaleones
 * seguidos en el corral se copiarian el uno al otro para siempre; con tres
 * podria montarse un ciclo. Se resuelve devolviendo el caso base, que es lo
 * que ya hacia cuando nadie le pasaba vecino.
 *
 * Devuelve `undefined` cuando no hay a quien copiar, y no 1: son dos cosas
 * distintas —"no hay vecino" contra "el vecino no aporta"— y el motor ya sabe
 * tratar la ausencia.
 */
export const factorDelVecinoEnElCorral = (
  corral: readonly string[],
  especie: string,
  tirada: number,
): number | undefined => {
  const donde = corral.indexOf(especie);
  if (donde < 0 || corral.length < 2) {
    return undefined;
  }
  const vecina = corral[donde + 1] ?? corral[donde - 1];
  if (vecina === undefined || !esEspecieId(vecina)) {
    return undefined;
  }
  const efecto = ESPECIES[vecina].efecto;
  if (efecto.clase === "copiaVecino") {
    return undefined;
  }
  // Sin contexto de grupo: lo que se copia es el bono PROPIO de la especie
  // vecina, no su situacion. Copiar tambien su contexto significaria heredar
  // las companeras de la hormiga o la franja del murcielago, que no son suyas.
  return factorDeEspecie(efecto, tirada, {}).factor;
};

const aEstado = (fila: PetState): EstadoDeMascota => ({
  hambre: fila.hambre,
  animo: fila.animo,
  nivel: fila.nivel,
  xp: fila.xp,
});

/**
 * Pasa el tiempo y paga el dia a las mascotas que toquen.
 *
 * **Un fallo con una mascota no para el barrido.** Si una fila esta corrupta o
 * su grupo tiene los ajustes rotos, se salta y siguen las demas: parar dejaria
 * sin comer a todo el mundo por culpa de una. Lo que si se propaga es un fallo
 * del propio barrido —no poder leer la cola—, porque eso si es un problema del
 * job y BullMQ tiene que verlo.
 */
export const procesarTickDeMascotas = async (
  contexto: ContextoDelTick,
): Promise<ResumenDelTick> => {
  const { mascotas, ajustesDeChat, ahora } = contexto;
  const limite = contexto.limite ?? MASCOTAS_POR_BARRIDO;

  const corte = new Date(ahora.getTime() - MINUTOS_ENTRE_REVISIONES * 60_000);
  const pendientes = await mascotas.paraElTick(corte, limite);

  let miradas = 0;
  let dormidas = 0;
  let pagadas = 0;
  let monedas = 0;
  let subidas = 0;
  let recuperadas = 0;
  let monedasRecuperadas = 0;
  let fallecidas = 0;

  // Una entrada por grupo y por barrido. El lote trae mascotas de varios chats
  // mezcladas, asi que sin esto serian dos consultas por mascota en vez de dos
  // por grupo.
  // Las subidas se juntan por chat y se anuncian al final, en un mensaje por
  // grupo. Ver `anunciar` en el contexto: de noche, un mensaje por mascota
  // seria un incidente.
  const subidasPorChat = new Map<
    string,
    {
      tenantId: string;
      chatId: string;
      subidas: {
        usuario: bigint;
        especie: string;
        nombre: string | null;
        nivel: number;
        evoluciona: boolean;
      }[];
    }
  >();

  const porGrupo = new Map<string, DatosDelGrupo>();
  const datosDe = async (
    tenantId: string,
    chatId: string,
  ): Promise<DatosDelGrupo> => {
    const clave = `${tenantId}:${chatId}`;
    const guardado = porGrupo.get(clave);
    if (guardado) {
      return guardado;
    }
    // Si un proveedor falla, el grupo se queda con su caso base y el barrido
    // sigue: un bonus que no se puede calcular no vale una mascota sin comer.
    const [porEspecie, diasLimpios, corral, novatos] = await Promise.all([
      contexto.especiesDelGrupo?.(tenantId, chatId).catch(() => ({})) ?? {},
      contexto.diasLimpiosDelGrupo?.(tenantId, chatId).catch(() => 0) ?? 0,
      contexto.corralDelGrupo?.(tenantId, chatId).catch(() => []) ?? [],
      contexto.novatosDelGrupo?.(tenantId, chatId).catch(() => 0) ?? 0,
    ]);
    const datos: DatosDelGrupo = {
      porEspecie,
      diasLimpios,
      corral,
      novatos,
    };
    porGrupo.set(clave, datos);
    return datos;
  };

  const diaUtc = diaUtcDe(ahora);

  for (const fila of pendientes) {
    try {
      const ajustes = parsearAjustes(
        await ajustesDeChat(fila.tenantId, fila.chatId),
      );
      if (!ajustes.activo) {
        // El grupo lo tiene apagado. Se le pasa el tiempo igual —el hambre no
        // se congela porque un admin toque un interruptor— pero no se le paga.
        const dormido = aplicarPasoDelTiempo(
          aEstado(fila),
          ahora.getTime() - fila.vistaEn.getTime(),
          fila.rasgos as readonly RasgoId[],
        );
        await mascotas.guardarEstado(fila.id, { ...dormido, vistaEn: ahora });
        miradas += 1;
        continue;
      }

      // La salud va ANTES que nada. Una muerta no come, no rinde y no gana XP:
      // procesarla seria pagarle el dia a un bicho que ya no esta.
      //
      // Y va DESPUES de la guarda de `activo` a proposito: apagar la feature
      // congela la ejecucion de la sentencia. Que un interruptor de grupo siga
      // matando mascotas es lo unico peor que no tener interruptor. El plazo no
      // se para —la fecha sigue corriendo—, pero la muerte solo la aplica este
      // barrido, asi que apagar y volver a encender la aplica entonces.
      if (tocaFallecer(fila, ahora)) {
        const muerta = await mascotas.fallecer(fila.id, ahora);
        if (muerta) {
          fallecidas += 1;
          // El aviso va con su propio catch: que Telegram no coja el mensaje no
          // puede abortar el barrido y dejar sin comer a las demas.
          await contexto
            .avisarDeSalud?.({
              tenantId: fila.tenantId,
              chatId: fila.chatId,
              usuario: fila.userTelegramId,
              especie: fila.especie,
              nombre: fila.nombre,
              clase: "muerte",
              coste: null,
              vence: null,
              motivo: fila.enfermaMotivo,
            })
            .catch(() => undefined);
        }
        miradas += 1;
        continue;
      }

      // Los recordatorios. `avisosQueTocan` devuelve CUANTOS deberian haber
      // salido ya, no si toca ahora: asi un worker parado media tarde manda al
      // volver el que falta en vez de perderlo, y dos barridos solapados no
      // mandan el mismo dos veces porque la marca va condicionada en el WHERE.
      const tocanAvisos = avisosQueTocan(fila, ahora);
      if (tocanAvisos > fila.curaAvisos) {
        const marcado = await mascotas.marcarAvisos(
          fila.id,
          fila.curaAvisos,
          tocanAvisos,
        );
        if (marcado) {
          await contexto
            .avisarDeSalud?.({
              tenantId: fila.tenantId,
              chatId: fila.chatId,
              usuario: fila.userTelegramId,
              especie: fila.especie,
              nombre: fila.nombre,
              clase: "recordatorio",
              coste: fila.curaCoste,
              vence: fila.curaVence,
              motivo: fila.enfermaMotivo,
            })
            .catch(() => undefined);
        }
      }

      const conElTiempo = aplicarPasoDelTiempo(
        aEstado(fila),
        ahora.getTime() - fila.vistaEn.getTime(),
        fila.rasgos as readonly RasgoId[],
      );

      // La especie viaja como texto en la base de datos —el catalogo crece por
      // tandas y un enum obligaria a migrar por cada especie nueva— asi que se
      // valida al leerla. Una fila con una especie que ya no existe se queda
      // sin rendimiento en vez de tumbar el barrido.
      if (!esEspecieId(fila.especie)) {
        await mascotas.guardarEstado(fila.id, {
          ...conElTiempo,
          vistaEn: ahora,
        });
        miradas += 1;
        continue;
      }

      // El contexto del grupo. Hasta hoy no se pasaba NINGUNO, asi que catorce
      // especies con efecto declarado no hacian nada: la ficha prometia algo
      // que no ocurria. Con esto se encienden diez; las otras cuatro esperan a
      // que existan los clanes y el embudo de novatos.
      const datos = await datosDe(fila.tenantId, fila.chatId);
      const vecino = factorDelVecinoEnElCorral(
        datos.corral,
        fila.especie,
        tiradaDelDia(fila.id, diaUtc),
      );
      const rendimiento = rendimientoDelDia({
        especie: fila.especie,
        estado: conElTiempo,
        rasgos: fila.rasgos as readonly RasgoId[],
        tirada: tiradaDelDia(fila.id, diaUtc),
        topeDiario: ajustes.topeDiarioPorMascota,
        contexto: {
          // Menos una: las suyas son las OTRAS, no ella misma.
          companeras: Math.max(0, (datos.porEspecie[fila.especie] ?? 1) - 1),
          esDeNoche: esDeNoche(ahora),
          diasLimpios: datos.diasLimpios,
          diaDeLaRacha: fila.racha,
          novatosQueSeQuedan: datos.novatos,
          // Se omite en vez de mandarse indefinido: con
          // `exactOptionalPropertyTypes` no es lo mismo, y ademas el motor
          // distingue "no hay vecino" de "el vecino no aporta".
          ...(vecino === undefined ? {} : { factorDelVecino: vecino }),
        },
      });

      if (rendimiento.monedas > 0) {
        const pago = await mascotas.pagarRendimiento({
          tenantId: fila.tenantId,
          chatId: fila.chatId,
          userTelegramId: fila.userTelegramId,
          monedas: rendimiento.monedas,
          diaUtc,
        });
        if (pago.ok) {
          pagadas += 1;
          monedas += rendimiento.monedas;
        }
      }

      // Lo robado que vuelve solo, poco a poco: el efecto del cangrejo.
      //
      // Va aqui y no en el robo porque es justo lo contrario de instantaneo —
      // "vuelve poco a poco" es una devolucion diaria— y este barrido ya es
      // quien sabe que dia es. La idempotencia la da el `refId` del libro
      // mayor, igual que el rendimiento: sin ella, un barrido cada quince
      // minutos devolveria lo robado noventa y seis veces al dia.
      const porDia = ventajasDe(fila.especie).robo.recuperaRobado;
      if (porDia > 0 && fila.robadoPendiente > 0) {
        // Hacia ARRIBA, y con al menos una moneda: con `floor`, un pendiente
        // de 4 y un 20% devolverian 0 para siempre y la deuda no bajaria
        // nunca. Redondear arriba garantiza que toda deuda acabe en cero.
        const devuelve = Math.min(
          fila.robadoPendiente,
          Math.max(1, Math.ceil(fila.robadoPendiente * porDia)),
        );
        const vuelta = await mascotas.devolverRobado({
          id: fila.id,
          tenantId: fila.tenantId,
          chatId: fila.chatId,
          userTelegramId: fila.userTelegramId,
          monedas: devuelve,
          diaUtc,
        });
        if (vuelta.ok) {
          recuperadas += 1;
          monedasRecuperadas += devuelve;
        }
      }

      // El cierre del dia va DESPUES del pago y sobre el estado ya envejecido:
      // la XP premia como estaba el bicho al acabar el dia, no como estaba
      // cuando alguien le dio de comer por ultima vez.
      //
      // **Una vez al dia, y lo decide `xpDia`.** Este barrido corre cada
      // quince minutos, asi que sin esta guarda `cerrarDia` repartia 10 XP
      // cada cuarto de hora: 96 veces mas rapido de lo diseñado. Se vio el
      // 2026-08-28 con mascotas a nivel 3 y 110 XP tres horas despues de
      // nacer, cuando les tocaba 0. El pago nunca lo sufrio porque a el ya lo
      // guardaba el `refId` del libro mayor, y esa asimetria es justo lo que
      // lo hizo dificil de ver: el dinero cuadraba y la XP no.
      //
      // Y se cierra sobre **lo mejor que estuvo la barra durante el dia**, no
      // sobre como esta ahora. Preguntando por el hambre de este instante se
      // pagaba el horario y no el cuidado: quien le daba de comer toda la
      // tarde llegaba a las dos de la madrugada con la barra ya baja y se
      // quedaba sin XP.
      const maximoDelDia =
        fila.hambreMaxDia === diaUtc ? fila.hambreMax : conElTiempo.hambre;
      const tocaCerrar = fila.xpDia !== diaUtc;
      const cierre = tocaCerrar
        ? cerrarDia(conElTiempo, maximoDelDia)
        : {
            estado: conElTiempo,
            haSubido: false,
            cuidada: false,
            evoluciona: false,
            nivel: conElTiempo.nivel,
          };
      if (cierre.haSubido) {
        subidas += 1;
      }
      // El anuncio va detras del ajuste `avisos`, que sale apagado. El
      // contador de arriba NO: sirve para la metrica y esa tiene que contar lo
      // que pasa aunque el grupo no quiera que se cuente.
      if (cierre.haSubido && ajustes.avisos) {
        const clave = `${fila.tenantId}:${fila.chatId}`;
        const grupo = subidasPorChat.get(clave) ?? {
          tenantId: fila.tenantId,
          chatId: fila.chatId,
          subidas: [],
        };
        grupo.subidas.push({
          usuario: fila.userTelegramId,
          especie: fila.especie,
          nombre: fila.nombre,
          nivel: cierre.nivel,
          evoluciona: cierre.evoluciona,
        });
        subidasPorChat.set(clave, grupo);
      }
      if (conElTiempo.hambre <= 0) {
        dormidas += 1;
      }

      // El maximo del dia se refresca en CADA revision, no solo al cerrar: si
      // el dia cambio, el maximo viejo ya no vale y el punto de partida es el
      // hambre de ahora. Comer lo levanta desde `servirRacion`, que es lo
      // unico que sube la barra.
      const maximoGuardado =
        fila.hambreMaxDia === diaUtc
          ? Math.max(fila.hambreMax, Math.round(conElTiempo.hambre))
          : Math.round(conElTiempo.hambre);

      await mascotas.guardarEstado(fila.id, {
        ...cierre.estado,
        vistaEn: ahora,
        hambreMax: maximoGuardado,
        hambreMaxDia: diaUtc,
        // Solo se marca cuando de verdad se ha cerrado. Escribirlo en cada
        // revision borraria la unica señal de que el cierre ya paso.
        ...(tocaCerrar
          ? {
              xpDia: diaUtc,
              // La racha se recalcula en el MISMO sitio que la marca del dia:
              // separarlas dejaria una racha que avanza sin dia cerrado, o al
              // reves, y las dos formas mienten.
              racha: rachaTrasCerrar({
                racha: fila.racha,
                ultimoDiaCerrado: fila.xpDia,
                diaQueSeCierra: diaUtc,
                cuidada: tocaCerrar ? cierre.cuidada : false,
              }),
            }
          : {}),
      });
      miradas += 1;
    } catch {
      // Una mascota rota no puede dejar sin comer a las demas. Se salta y el
      // resumen lo delata: `miradas` sale por debajo del lote leido.
    }
  }

  // El anuncio va al final y **fuera del bucle**: un mensaje por grupo con
  // todas las subidas juntas, no uno por mascota. Ver `anunciar` en el
  // contexto — el cierre corre a las dos de la madrugada.
  //
  // Un fallo al anunciar no puede deshacer el barrido: la XP ya esta guardada
  // y volver a pasar por aqui no la daria otra vez, asi que lanzar solo
  // conseguiria que BullMQ reintentara un trabajo que ya esta hecho.
  if (contexto.anunciar && subidasPorChat.size > 0) {
    for (const grupo of subidasPorChat.values()) {
      try {
        await contexto.anunciar(grupo);
      } catch {
        // Que no se entere el grupo es peor que nada, pero mucho menos malo
        // que reintentar el barrido entero.
      }
    }
  }

  return {
    miradas,
    dormidas,
    pagadas,
    monedas,
    subidas,
    recuperadas,
    monedasRecuperadas,
    fallecidas,
  };
};
