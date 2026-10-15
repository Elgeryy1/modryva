import {
  decidirAlta,
  decidirTrasLaEntrada,
  leerMandoDeAyudante,
  type MandoDeAyudante,
  type NivelDeAyudante,
  nivelDelMando,
  PERMISOS_DE_AUDITORIA,
  PERMISOS_PARA_DEGRADAR,
  SEGUNDOS_DE_VIDA_DEL_ENLACE,
  SOLO_EL_PROPIETARIO,
  TEXTO_DE_AYUDA,
  USOS_DEL_ENLACE,
} from "./vincular-ayudante.js";

/**
 * La ejecucion de `/ayudante`. `vincular-ayudante.ts` decide; esto hace.
 *
 * Vive fuera del nucleo por lo de siempre: el nucleo solo puede encoger, y
 * esto se prueba suelto con dobles, sin arrancar el servicio ni hablar con
 * Telegram.
 */

/** La clave bajo la que se recuerda que se pidio meter al ayudante en este chat. */
export const CLAVE_DE_AJUSTE = "ayudante";

export interface EstadoGuardado {
  readonly nivel: NivelDeAyudante;
  readonly pedidoEn: string;
}

/** Lo que hace falta del mundo para ejecutar un mando. */
export interface DependenciasDeAyudante {
  readonly esPropietario: (quien: bigint) => boolean;
  readonly idDelAyudante: bigint | null;
  readonly crearEnlace: (input: {
    readonly chatId: bigint;
    readonly usos: number;
    readonly caducaEn: number;
  }) => Promise<{ readonly ok: boolean; readonly enlace: string | null }>;
  readonly encolar: (input: {
    readonly tipo: string;
    readonly payload: unknown;
  }) => Promise<void>;
  readonly promover: (input: {
    readonly chatId: bigint;
    readonly userId: bigint;
    readonly permisos: Record<string, boolean>;
  }) => Promise<{ readonly ok: boolean }>;
  /** El estado de alguien en el grupo: "member", "administrator"... o `null` si no esta. */
  readonly estadoEnElGrupo: (
    chatId: bigint,
    userId: bigint,
  ) => Promise<string | null>;
  readonly guardarNivel: (nivel: NivelDeAyudante | null) => Promise<void>;
  readonly leerNivel: () => Promise<NivelDeAyudante | null>;
  readonly ahora: () => Date;
}

export interface RespuestaDeAyudante {
  readonly texto: string;
}

const NO_CONFIGURADO =
  "El Ayudante no está configurado en este bot: falta " +
  "<code>AYUDANTE_TELEGRAM_ID</code> en el entorno.";

/**
 * Ejecuta `/ayudante <que>`. Devuelve `null` si el texto no es este mando,
 * para que la cadena de handlers siga su camino.
 *
 * El orden importa y no es casual: **primero se comprueba quien manda**, antes
 * de crear ningun enlace. Crear el enlace y luego rechazar dejaria un enlace
 * vivo generado por alguien que no tenia derecho a pedirlo.
 */
export const atenderMandoDeAyudante = async (input: {
  readonly texto: string;
  readonly autor: bigint;
  readonly chatId: bigint;
  readonly deps: DependenciasDeAyudante;
}): Promise<RespuestaDeAyudante | null> => {
  const mando = leerMandoDeAyudante(input.texto);
  if (mando === null) return null;

  if (mando.que === "ayuda") return { texto: TEXTO_DE_AYUDA };

  if (!input.deps.esPropietario(input.autor)) {
    return { texto: SOLO_EL_PROPIETARIO };
  }
  if (input.deps.idDelAyudante === null) {
    return { texto: NO_CONFIGURADO };
  }

  if (mando.que === "estado") return atenderEstado(input.deps);
  if (mando.que === "quitar") {
    return atenderQuitar(input.chatId, input.deps);
  }
  return atenderAlta(mando, input.chatId, input.deps);
};

const atenderEstado = async (
  deps: DependenciasDeAyudante,
): Promise<RespuestaDeAyudante> => {
  const nivel = await deps.leerNivel();
  if (nivel === null) {
    return {
      texto:
        "El Ayudante no está activado en este grupo.\n" +
        "<code>/ayudante activar</code> para meterlo.",
    };
  }
  return {
    texto:
      nivel === "auditoria"
        ? "El Ayudante está activado <b>con auditoría</b> (puede leer el registro de administración)."
        : "El Ayudante está activado <b>como miembro</b>. Menciones y censo funcionando; sin permisos.",
  };
};

const atenderQuitar = async (
  chatId: bigint,
  deps: DependenciasDeAyudante,
): Promise<RespuestaDeAyudante> => {
  const idDelAyudante = deps.idDelAyudante;
  if (idDelAyudante === null) return { texto: NO_CONFIGURADO };

  // Degradar ANTES de pedirle que se vaya: al revés, si la salida va bien y la
  // degradación falla, queda un ex-miembro con cargo guardado en el grupo.
  await deps.promover({
    chatId,
    userId: idDelAyudante,
    permisos: { ...PERMISOS_PARA_DEGRADAR },
  });
  await deps.encolar({
    tipo: "vinculacion.salir_del_grupo",
    payload: { chatId: chatId.toString() },
  });
  await deps.guardarNivel(null);

  return {
    texto:
      "Quitado. Le he retirado el cargo y le he pedido que salga del grupo.",
  };
};

const atenderAlta = async (
  mando: MandoDeAyudante,
  chatId: bigint,
  deps: DependenciasDeAyudante,
): Promise<RespuestaDeAyudante> => {
  const nivel = nivelDelMando(mando);
  if (nivel === null) return { texto: TEXTO_DE_AYUDA };
  const idDelAyudante = deps.idDelAyudante;
  if (idDelAyudante === null) return { texto: NO_CONFIGURADO };

  // Se mira DONDE esta ya la cuenta antes de nada. Si ya esta dentro no hay
  // entrada que esperar, y colgar la promocion del evento de entrada la
  // dejaba de miembro raso para siempre: el evento no vuelve a ocurrir.
  const estado = await deps.estadoEnElGrupo(chatId, idDelAyudante);
  const accion = decidirAlta(estado, nivel);

  if (accion === "promover") {
    await deps.guardarNivel(nivel);
    const hecho = await deps.promover({
      chatId,
      userId: idDelAyudante,
      permisos: { ...PERMISOS_DE_AUDITORIA },
    });
    return {
      texto: hecho.ok
        ? "Ya estaba dentro. Le he dado el permiso de auditoría (solo invitar): " +
          "no puede borrar, expulsar ni fijar."
        : "Ya estaba dentro, pero no he podido darle el cargo. " +
          "Necesito ser administrador con permiso para nombrar administradores.",
    };
  }

  if (accion === "ya-esta") {
    await deps.guardarNivel(nivel);
    return {
      texto:
        nivel === "auditoria"
          ? "El Ayudante ya estaba dentro y con permiso de auditoría."
          : "El Ayudante ya estaba dentro de este grupo.",
    };
  }

  const caducaEn =
    Math.floor(deps.ahora().getTime() / 1000) + SEGUNDOS_DE_VIDA_DEL_ENLACE;
  const enlace = await deps.crearEnlace({
    chatId,
    usos: USOS_DEL_ENLACE,
    caducaEn,
  });

  if (!enlace.ok || enlace.enlace === null) {
    return {
      texto:
        "No he podido crear el enlace de invitación. " +
        "Comprueba que soy administrador con permiso para invitar.",
    };
  }

  // Se recuerda el nivel ANTES de encolar. Si se guardara después, el ayudante
  // podría entrar antes de que quedase escrito y la promoción se perdería.
  await deps.guardarNivel(nivel);
  await deps.encolar({
    tipo: "vinculacion.unirse_a_grupo",
    payload: { enlace: enlace.enlace },
  });

  return {
    texto:
      nivel === "auditoria"
        ? "Metiendo al Ayudante y dándole el permiso de auditoría. Tarda unos segundos."
        : "Metiendo al Ayudante como miembro. Tarda unos segundos.\n" +
          "Con esto ya funcionan las menciones a quien no tiene @alias y el censo real.",
  };
};

/**
 * Qué hacer cuando alguien entra en el grupo. Devuelve el texto a publicar, o
 * `null` si no hay nada que decir — que es el caso de casi todas las entradas.
 */
export const atenderEntradaEnElGrupo = async (input: {
  readonly quienEntro: bigint;
  readonly chatId: bigint;
  readonly deps: DependenciasDeAyudante;
}): Promise<RespuestaDeAyudante | null> => {
  const idDelAyudante = input.deps.idDelAyudante;
  if (idDelAyudante === null) return null;
  if (input.quienEntro !== idDelAyudante) return null;

  const nivelPedido = await input.deps.leerNivel();
  const { promover } = decidirTrasLaEntrada({
    quienEntro: input.quienEntro,
    idDelAyudante,
    nivelPedido,
  });

  if (!promover) {
    return {
      texto:
        "Ayudante dentro. Menciones y censo ya funcionan; no tiene ningún permiso.",
    };
  }

  const resultado = await input.deps.promover({
    chatId: input.chatId,
    userId: idDelAyudante,
    permisos: { ...PERMISOS_DE_AUDITORIA },
  });

  return {
    texto: resultado.ok
      ? "Ayudante dentro y con permiso de auditoría (solo invitar). " +
        "No puede borrar, expulsar ni fijar."
      : "Ayudante dentro, pero no he podido darle el cargo. " +
        "Necesito ser administrador con permiso para nombrar administradores.",
  };
};
