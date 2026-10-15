import type { AyudanteAvisoPrivadoRepository } from "@superbot/data";
import { enviarAvisoPrivado, type ResultadoAvisoPrivado } from "../avisos.js";
import type {
  CatalogoDeManejadores,
  ManejadorDeSolicitud,
} from "../despachador.js";

/**
 * Bloque G: SOLO LECTURA de mascotas. No toca `modules/games/src/pets/*`,
 * `apps/worker/src/pets-tick.ts` ni `apps/worker/src/server.ts` -- otra
 * sesion trabaja ahi mismo en paralelo (ver `docs/PLAN-AYUDANTE.md`).
 *
 * `MascotaParaResumen` es un tipo PROPIO y PROVISIONAL: `PetState`
 * (`packages/data/src/pet-repository.ts`) tiene muchos mas campos (animo,
 * racha, enferma*, curaCoste...) que este bloque no necesita para componer un
 * resumen ni para decidir un aviso de hambre. Cuando se cablee de verdad
 * contra la cola del ayudante, quien adapte `PetState` a esto elige que
 * campos traducir -- este bloque no importa nada de `pet-repository.ts`.
 */
export interface MascotaParaResumen {
  readonly dueñoTelegramId: bigint;
  readonly nombre: string | null;
  readonly especie: string;
  readonly nivel: number;
  readonly hambre: number;
}

// ---------------------------------------------------------------------------
// Lectura de payload -- la cola guarda JSON (`Json` en Prisma), asi que todo
// lo que llega a un manejador es `unknown` y hay que validarlo a mano antes
// de tocarlo. Mismo patron que `bloques/identidad.ts` y `bloques/censo.ts`.
// ---------------------------------------------------------------------------

const comoRegistro = (payload: unknown): Record<string, unknown> => {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("payload invalido: se esperaba un objeto");
  }
  return payload as Record<string, unknown>;
};

const comoBigInt = (valor: unknown, campo: string): bigint => {
  if (typeof valor === "number" && Number.isInteger(valor)) {
    return BigInt(valor);
  }
  if (typeof valor === "string" && /^-?\d+$/u.test(valor)) {
    return BigInt(valor);
  }
  throw new Error(`payload invalido: "${campo}" no es un entero valido`);
};

const comoEntero = (valor: unknown, campo: string): number => {
  if (typeof valor === "number" && Number.isInteger(valor)) return valor;
  if (typeof valor === "string" && /^-?\d+$/u.test(valor)) {
    return Number(valor);
  }
  throw new Error(`payload invalido: "${campo}" no es un entero valido`);
};

/**
 * A diferencia de `comoEntero`, acepta decimales: el hambre de una mascota se
 * desgasta de forma continua (`HAMBRE_POR_HORA`, ver CLAUDE.md), asi que
 * puede llegar como `47.5` y truncarla aqui perderia precision sin motivo.
 */
const comoNumero = (valor: unknown, campo: string): number => {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "") {
    const n = Number(valor);
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`payload invalido: "${campo}" no es un numero valido`);
};

const comoTexto = (valor: unknown, campo: string): string => {
  if (typeof valor !== "string" || valor.length === 0) {
    throw new Error(`payload invalido: "${campo}" no es un texto valido`);
  }
  return valor;
};

const comoTextoONulo = (valor: unknown, campo: string): string | null =>
  valor === null || valor === undefined ? null : comoTexto(valor, campo);

const comoArray = (valor: unknown, campo: string): readonly unknown[] => {
  if (!Array.isArray(valor)) {
    throw new Error(`payload invalido: "${campo}" no es un array`);
  }
  return valor;
};

const comoMascotaParaResumen = (valor: unknown): MascotaParaResumen => {
  const datos = comoRegistro(valor);
  return {
    dueñoTelegramId: comoBigInt(datos.dueñoTelegramId, "dueñoTelegramId"),
    nombre: comoTextoONulo(datos.nombre, "nombre"),
    especie: comoTexto(datos.especie, "especie"),
    nivel: comoEntero(datos.nivel, "nivel"),
    hambre: comoNumero(datos.hambre, "hambre"),
  };
};

// ---------------------------------------------------------------------------
// 1 y 2. Resumen nocturno -- compone, no envia
// ---------------------------------------------------------------------------

const SIN_MASCOTAS_EN_EL_GRUPO = "Esta noche no hay mascotas en el grupo.";

/**
 * Compone UN SOLO mensaje con todas las mascotas del grupo -- nunca uno por
 * mascota, decision ya tomada en CLAUDE.md (seccion Mascotas, propiedad de la
 * XP): un aviso por bicho a las dos de la madrugada es el incidente del
 * `@all` otra vez.
 *
 * Contrato del marcador `{{MENCION:<telegramId>}}`: este bloque es de solo
 * lectura y no resuelve `access_hash` ni construye una entidad de Telegram
 * -- eso es tarea del bloque de comunicacion (D), que sustituira cada
 * marcador por una mencion real antes de enviar. Dejarlo como texto plano
 * (nunca HTML ya compuesto, nunca una entidad ya resuelta) es lo que permite
 * que esta funcion sea PURA y se pruebe sin userbot y sin red.
 */
export const componerResumenNocturno = (
  mascotas: readonly MascotaParaResumen[],
): string => {
  if (mascotas.length === 0) return SIN_MASCOTAS_EN_EL_GRUPO;

  const lineas = mascotas.map((mascota) => {
    const nombre = mascota.nombre ?? "sin nombre";
    return `• {{MENCION:${mascota.dueñoTelegramId}}} — ${nombre} (${mascota.especie}), nivel ${mascota.nivel}, hambre ${Math.round(mascota.hambre)}`;
  });

  return ["🌙 Resumen nocturno de las mascotas", "", ...lineas].join("\n");
};

export interface ResultadoResumenNocturno {
  readonly texto: string;
}

/**
 * `mascotas.resumen_nocturno`: traduce el payload y delega en
 * `componerResumenNocturno`. Devuelve el texto -- NO lo envia. Enviarlo (y
 * resolver los marcadores de mencion) es un paso de integracion posterior,
 * fuera de este bloque.
 */
const resumenNocturno: ManejadorDeSolicitud = async (payload, contexto) => {
  const datos = comoRegistro(payload);
  const tenantId = comoTexto(datos.tenantId, "tenantId");
  const chatId = comoBigInt(datos.chatId, "chatId");
  const mascotas = comoArray(datos.mascotas, "mascotas").map(
    comoMascotaParaResumen,
  );

  const texto = componerResumenNocturno(mascotas);

  contexto.logger.info(
    { tenantId, chatId, total: mascotas.length },
    "mascotas: resumen nocturno compuesto",
  );

  const resultado: ResultadoResumenNocturno = { texto };
  return resultado;
};

// ---------------------------------------------------------------------------
// 3 y 4. Aviso de hambre por privado
// ---------------------------------------------------------------------------

/** A partir de aqui se considera urgente avisar: la mascota se duerme pronto. */
export const UMBRAL_HORAS_AVISO_HAMBRE = 2;

/**
 * Pura: decide si toca avisar por privado antes de que la mascota se duerma
 * de hambre.
 *
 * La cota inferior importa tanto como la superior. `horasHastaDormir`
 * negativo significa que la mascota YA se durmio hace ese rato, y avisar
 * entonces manda "se va a dormir en cualquier momento" a alguien cuyo bicho
 * lleva dos dias dormido. Este aviso es de anticipacion; lo que toque decir
 * cuando ya esta dormida es otro aviso, con otro texto y otro `tipo`.
 */
export const debeAvisarPorHambre = (horasHastaDormir: number): boolean =>
  horasHastaDormir >= 0 && horasHastaDormir <= UMBRAL_HORAS_AVISO_HAMBRE;

const textoAvisoHambre = (
  nombreMascota: string | null,
  horasHastaDormir: number,
): string => {
  const nombre = nombreMascota ?? "Tu mascota";
  const horas = Math.max(0, Math.round(horasHastaDormir));
  const cuando =
    horas <= 0
      ? "en cualquier momento"
      : `en menos de ${horas} ${horas === 1 ? "hora" : "horas"}`;
  return `${nombre} se va a dormir de hambre ${cuando} si no la alimentas.`;
};

const TIPO_AVISO_HAMBRE = "mascotas.aviso_hambre";

export interface RepositoriosDeMascotas {
  readonly avisos: AyudanteAvisoPrivadoRepository;
}

export interface ResultadoAvisoHambre {
  readonly avisado: boolean;
  readonly resultadoEnvio?: ResultadoAvisoPrivado;
}

/**
 * `mascotas.aviso_hambre`: si `debeAvisarPorHambre` dice que si, manda el
 * privado (aunque el dueño tenga el bot bloqueado, para eso existe el
 * ayudante) a traves de `enviarAvisoPrivado`, que garantiza como mucho uno al
 * dia por (persona, tipo). Esa garantia es la que hace este manejador seguro
 * de encolar desde un barrido que corre cada quince minutos.
 */
const avisoHambre = (repos: RepositoriosDeMascotas): ManejadorDeSolicitud => {
  return async (payload, contexto) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const dueñoTelegramId = comoBigInt(
      datos.dueñoTelegramId,
      "dueñoTelegramId",
    );
    const nombreMascota = comoTextoONulo(datos.nombreMascota, "nombreMascota");
    const horasHastaDormir = comoNumero(
      datos.horasHastaDormir,
      "horasHastaDormir",
    );

    if (!debeAvisarPorHambre(horasHastaDormir)) {
      const resultado: ResultadoAvisoHambre = { avisado: false };
      return resultado;
    }

    const resultadoEnvio = await enviarAvisoPrivado(
      repos.avisos,
      contexto.userbot,
      {
        tenantId,
        destinatarioTelegramId: dueñoTelegramId,
        tipo: TIPO_AVISO_HAMBRE,
        texto: textoAvisoHambre(nombreMascota, horasHastaDormir),
      },
    );

    contexto.logger.info(
      {
        tenantId,
        dueñoTelegramId: dueñoTelegramId.toString(),
        yaAvisado: resultadoEnvio.yaAvisado,
        estado: resultadoEnvio.envio?.estado ?? null,
      },
      "mascotas: aviso de hambre enviado",
    );

    const resultado: ResultadoAvisoHambre = { avisado: true, resultadoEnvio };
    return resultado;
  };
};

/** El catalogo del bloque, con el repositorio ya inyectado. */
export const crearManejadoresDeMascotas = (
  repos: RepositoriosDeMascotas,
): CatalogoDeManejadores => ({
  "mascotas.resumen_nocturno": resumenNocturno,
  "mascotas.aviso_hambre": avisoHambre(repos),
});

/**
 * Alias con el nombre de catalogo pedido para la integracion de este bloque.
 * Sigue siendo una fabrica -- no un objeto ya construido -- porque
 * `mascotas.aviso_hambre` necesita `AyudanteAvisoPrivadoRepository` inyectado
 * y este fichero no instancia el repositorio Prisma real (eso lo hace
 * `index.ts`, igual que ya hace con `crearManejadoresDeIdentidad` y
 * `crearManejadoresDeCenso`).
 */
export const manejadoresDeMascotas = crearManejadoresDeMascotas;
