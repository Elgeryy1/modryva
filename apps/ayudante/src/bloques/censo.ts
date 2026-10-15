import type {
  AyudanteCensoRepository,
  FilaCenso,
  MiembroCensado,
} from "@superbot/data";
import type {
  CatalogoDeManejadores,
  ManejadorDeSolicitud,
} from "../despachador.js";

// ---------------------------------------------------------------------------
// Lectura de payload -- la cola guarda JSON (`Json` en Prisma), asi que todo
// lo que llega a un manejador es `unknown` y hay que validarlo a mano antes
// de tocarlo. Mismo patron que `bloques/identidad.ts`.
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

/**
 * Un campo opcional puede llegar como `null` explicito o directamente no
 * llegar. Las dos formas son la misma cosa aqui: `JSON.stringify` elimina las
 * claves con `undefined` al guardar el payload, asi que quien encole
 * `{ texto: undefined }` produce un payload sin `texto`. Tratar solo `null`
 * hacia que una busqueda sin filtro -- el caso normal -- lanzara "payload
 * invalido" y se reintentara tres veces antes de perderse.
 */
const comoBigIntONulo = (valor: unknown, campo: string): bigint | null =>
  valor === null || valor === undefined ? null : comoBigInt(valor, campo);

const comoEntero = (valor: unknown, campo: string): number => {
  if (typeof valor === "number" && Number.isInteger(valor)) return valor;
  if (typeof valor === "string" && /^-?\d+$/u.test(valor)) {
    return Number(valor);
  }
  throw new Error(`payload invalido: "${campo}" no es un entero valido`);
};

const comoTexto = (valor: unknown, campo: string): string => {
  if (typeof valor !== "string" || valor.length === 0) {
    throw new Error(`payload invalido: "${campo}" no es un texto valido`);
  }
  return valor;
};

const comoTextoONulo = (valor: unknown, campo: string): string | null =>
  valor === null || valor === undefined ? null : comoTexto(valor, campo);

// ---------------------------------------------------------------------------
// 1. censo.censar_grupo
// ---------------------------------------------------------------------------

export interface RepositoriosDeCenso {
  readonly censo: AyudanteCensoRepository;
}

export interface ResultadoCensarGrupo {
  readonly total: number;
  readonly salidasSilenciosas: readonly bigint[];
}

/**
 * `censo.censar_grupo`: pide al userbot el censo real del grupo
 * (`channels.getParticipants`, algo que un bot no puede hacer) y lo aplica al
 * repositorio, que decide quien sigue presente y quien salio en silencio.
 *
 * El `chatId` que trae el payload es el id numerico de Telegram -- hace
 * falta tal cual para `listarMiembros`, que habla con MTProto -- y se
 * convierte a texto solo al guardar, porque `AyudanteCensoMiembro.chatId` es
 * `String` en el esquema.
 */
const censarGrupo = (repos: RepositoriosDeCenso): ManejadorDeSolicitud => {
  return async (payload, contexto) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const chatId = comoBigInt(datos.chatId, "chatId");

    const miembros = await contexto.userbot.listarMiembros(chatId);
    const censados: MiembroCensado[] = miembros.map((miembro) => ({
      chatId: chatId.toString(),
      userTelegramId: miembro.userTelegramId,
      alias: miembro.alias,
      nombre: miembro.nombre,
      ultimaConexionEn: miembro.ultimaConexionEn,
    }));

    const { salidasSilenciosas } = await repos.censo.aplicarCenso({
      tenantId,
      chatId: chatId.toString(),
      miembros: censados,
    });

    contexto.logger.info(
      {
        tenantId,
        chatId,
        total: miembros.length,
        salidas: salidasSilenciosas.length,
      },
      "censo: censo del grupo aplicado",
    );

    const resultado: ResultadoCensarGrupo = {
      total: miembros.length,
      salidasSilenciosas,
    };
    return resultado;
  };
};

// ---------------------------------------------------------------------------
// 2. Fantasmas -- pura
// ---------------------------------------------------------------------------

/**
 * Quien sigue presente en el censo pero no tiene ninguna actividad conocida
 * -- ni un mensaje, ni una reaccion, nada que `member_activity_profiles`
 * (fuera de alcance de este bloque) haya registrado nunca. `idsConActividad`
 * ya viene calculado por quien llama: este bloque no cruza tablas ajenas.
 *
 * Filtra por `presente` aqui dentro, no confia en que quien llame ya haya
 * usado `listarPresentes` en vez de `listarDelGrupo` -- ser pura significa
 * dar el resultado correcto sea cual sea el origen de la lista.
 */
export const calcularFantasmas = (
  miembrosCensados: readonly FilaCenso[],
  idsConActividad: Set<string>,
): readonly FilaCenso[] =>
  miembrosCensados.filter(
    (fila) =>
      fila.presente && !idsConActividad.has(fila.userTelegramId.toString()),
  );

// ---------------------------------------------------------------------------
// 3. Cambio de alias -- pura
// ---------------------------------------------------------------------------

/**
 * Casi todo alias es un `@username`, y Telegram no distingue mayusculas de
 * minusculas en ellos -- `@Fulano` y `@fulano` son la misma cuenta. Por eso
 * se normaliza a minusculas antes de comparar: si dos pasadas del censo leen
 * el mismo username con distinta capitalizacion (pasa con algunos clientes),
 * no debe registrarse como un cambio que no existio. `null` a algo y algo a
 * `null` siempre cuentan como cambio, entren donde entren.
 */
export const detectarCambioDeAlias = (
  anterior: string | null,
  actual: string | null,
): boolean => {
  if (anterior === null && actual === null) return false;
  if (anterior === null || actual === null) return true;
  return anterior.toLowerCase() !== actual.toLowerCase();
};

// ---------------------------------------------------------------------------
// 4. censo.buscar_historial -- solo texto, ver docs/PLAN-AYUDANTE.md
// ---------------------------------------------------------------------------

/**
 * `censo.buscar_historial`: delega entero en `userbot.buscarEnHistorial` y
 * devuelve `MensajeDeHistorial` tal cual llega. Ese tipo no tiene ningun
 * campo de foto ni de video -- no hay nada que filtrar ni que añadir aqui.
 * No busques "solo fotos" ni nada parecido: esta prohibido sin excepcion de
 * bloque.
 */
const buscarHistorial: ManejadorDeSolicitud = async (payload, contexto) => {
  const datos = comoRegistro(payload);
  const chatId = comoBigInt(datos.chatId, "chatId");
  const texto = comoTextoONulo(datos.texto, "texto");
  const deUsuario = comoBigIntONulo(datos.deUsuario, "deUsuario");
  const limite = comoEntero(datos.limite, "limite");

  return contexto.userbot.buscarEnHistorial({
    chatId,
    texto,
    deUsuario,
    limite,
  });
};

/** El catalogo del bloque, con el repositorio ya inyectado. */
export const crearManejadoresDeCenso = (
  repos: RepositoriosDeCenso,
): CatalogoDeManejadores => ({
  "censo.censar_grupo": censarGrupo(repos),
  "censo.buscar_historial": buscarHistorial,
});
