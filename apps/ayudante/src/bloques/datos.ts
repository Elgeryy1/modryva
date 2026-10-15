import type { AyudanteCensoRepository, FilaCenso } from "@superbot/data";
import type {
  CatalogoDeManejadores,
  ManejadorDeSolicitud,
} from "../despachador.js";

// ---------------------------------------------------------------------------
// Lectura de payload -- mismo patron que `bloques/censo.ts` e
// `bloques/identidad.ts`: la cola guarda JSON, asi que todo llega `unknown`.
// ---------------------------------------------------------------------------

const comoRegistro = (payload: unknown): Record<string, unknown> => {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("payload invalido: se esperaba un objeto");
  }
  return payload as Record<string, unknown>;
};

const comoTexto = (valor: unknown, campo: string): string => {
  if (typeof valor !== "string" || valor.length === 0) {
    throw new Error(`payload invalido: "${campo}" no es un texto valido`);
  }
  return valor;
};

const comoEntero = (valor: unknown, campo: string): number => {
  if (typeof valor === "number" && Number.isInteger(valor)) return valor;
  if (typeof valor === "string" && /^-?\d+$/u.test(valor)) {
    return Number(valor);
  }
  throw new Error(`payload invalido: "${campo}" no es un entero valido`);
};

const comoFechaOpcional = (valor: unknown, campo: string): Date | undefined => {
  if (valor === undefined) return undefined;
  if (typeof valor !== "string") {
    throw new Error(`payload invalido: "${campo}" no es una fecha valida`);
  }
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new Error(`payload invalido: "${campo}" no es una fecha valida`);
  }
  return fecha;
};

// ---------------------------------------------------------------------------
// Decision: agregados de actividad son visibles para el staff sin distincion
// ParaStaff/ParaPropietario. `docs/PLAN-AYUDANTE.md` reserva esa separacion
// para lo que identifica a alguien (ficha completa, admin log con actor); un
// mapa de horas o "quien esta en linea ahora" no señala a nadie en concreto
// mas de lo que el propio grupo ya deja ver con la marca de "en linea" de
// Telegram junto a cada nombre. Por eso este bloque no tiene una version
// "para el propietario": las dos funciones sirven igual a cualquiera.
// ---------------------------------------------------------------------------

export interface RepositoriosDeDatos {
  readonly censo: AyudanteCensoRepository;
}

// ---------------------------------------------------------------------------
// 1. Mapa de horas activas -- pura
// ---------------------------------------------------------------------------

/** Un mapa de horas UTC (0-23) vacio, para no dejar huecos `undefined` en el resultado. */
const mapaVacio = (): Record<number, number> => {
  const mapa: Record<number, number> = {};
  for (let hora = 0; hora < 24; hora += 1) mapa[hora] = 0;
  return mapa;
};

/**
 * Pura: cuenta en que hora UTC cayo cada `ultimaConexionEn`. No es un
 * historial de conexiones -- es la unica marca que guarda el censo por
 * persona --, asi que el mapa resultante es "en que hora se vio por ultima
 * vez a cada quien", no "cuanta actividad hubo cada hora". Sigue siendo util
 * para ver el reparto horario del grupo, que es lo que pide el bloque.
 */
export const calcularMapaDeHoras = (
  vistos: readonly { readonly ultimaConexionEn: Date }[],
): Record<number, number> => {
  const mapa = mapaVacio();
  for (const visto of vistos) {
    const hora = visto.ultimaConexionEn.getUTCHours();
    mapa[hora] = (mapa[hora] ?? 0) + 1;
  }
  return mapa;
};

/**
 * `datos.mapa_de_horas`: lista el censo entero del grupo (presentes y no --
 * la hora de actividad de quien ya se fue sigue siendo un dato valido sobre
 * el reparto horario del grupo) y descarta a quien nunca se ha registrado
 * con `ultimaConexionEn`.
 */
const mapaDeHoras = (repos: RepositoriosDeDatos): ManejadorDeSolicitud => {
  return async (payload) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const chatId = comoTexto(datos.chatId, "chatId");

    const censados = await repos.censo.listarDelGrupo(tenantId, chatId);
    const conConexion = censados.filter(
      (fila): fila is FilaCenso & { ultimaConexionEn: Date } =>
        fila.ultimaConexionEn !== null,
    );

    return calcularMapaDeHoras(conConexion);
  };
};

// ---------------------------------------------------------------------------
// 2. Quien esta en linea -- pura
// ---------------------------------------------------------------------------

/**
 * Pura: filtra por ventana de tiempo respecto a `ahora`. Separada del
 * manejador para poder fijar `ahora` en los tests sin tocar el reloj del
 * proceso -- mismo motivo que "el reloj entra por parametro" en las
 * extracciones profundas de `CLAUDE.md`.
 */
export const filtrarEnLinea = (
  censados: readonly FilaCenso[],
  minutosParaConsiderarEnLinea: number,
  ahora: Date,
): readonly FilaCenso[] => {
  const limiteMs = minutosParaConsiderarEnLinea * 60_000;
  return censados.filter((fila) => {
    if (fila.ultimaConexionEn === null) return false;
    const antiguedadMs = ahora.getTime() - fila.ultimaConexionEn.getTime();
    return antiguedadMs >= 0 && antiguedadMs <= limiteMs;
  });
};

/**
 * `datos.quien_esta_en_linea`: solo mira a quien sigue presente en el grupo
 * (`listarPresentes`) -- alguien que ya salio no esta "en linea" para nadie,
 * por reciente que sea su ultima conexion conocida.
 *
 * `ahora` es opcional en el payload a proposito: en produccion nunca llega
 * (usa `new Date()`, reloj de pared real), y en los tests se fija para poder
 * probar el borde exacto de la ventana sin depender del reloj del proceso.
 */
const quienEstaEnLinea = (repos: RepositoriosDeDatos): ManejadorDeSolicitud => {
  return async (payload) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const chatId = comoTexto(datos.chatId, "chatId");
    const minutosParaConsiderarEnLinea = comoEntero(
      datos.minutosParaConsiderarEnLinea,
      "minutosParaConsiderarEnLinea",
    );
    const ahora = comoFechaOpcional(datos.ahora, "ahora") ?? new Date();

    const presentes = await repos.censo.listarPresentes(tenantId, chatId);
    return filtrarEnLinea(presentes, minutosParaConsiderarEnLinea, ahora);
  };
};

/** El catalogo del bloque, con el repositorio ya inyectado. */
export const manejadoresDeDatos = (
  repos: RepositoriosDeDatos,
): CatalogoDeManejadores => ({
  "datos.mapa_de_horas": mapaDeHoras(repos),
  "datos.quien_esta_en_linea": quienEstaEnLinea(repos),
});
