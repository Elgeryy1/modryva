/**
 * Meter al Ayudante en un grupo desde el propio bot, sin que nadie toque nada.
 *
 * Vive fuera de `bot-update.service.ts` a proposito: el nucleo solo puede
 * encoger, y ademas esto se prueba suelto, sin arrancar el servicio.
 *
 * **El baile lo impone Telegram**: un bot NO puede añadir a nadie a un grupo
 * (la Bot API no tiene `addChatMember`). Asi que:
 *
 *   1. Modryva crea un enlace de UN SOLO USO y de pocos minutos.
 *   2. Lo encola para el ayudante (`vinculacion.unirse_a_grupo`).
 *   3. El ayudante se une el mismo.
 *   4. Modryva ve la entrada como un update normal y, si se pidio auditoria,
 *      lo promueve con el permiso minimo.
 *
 * El paso 4 va por el update de entrada y no leyendo la cola: el bot no espera
 * a nadie, y la cola sigue siendo de un solo sentido.
 *
 * Tres cosas que **no se pueden aflojar**:
 *
 * 1. **Solo el propietario.** Meter una segunda identidad en el grupo, y mas
 *    aun darle galones, no es moderar. Un moderador que pudiera hacerlo tendria
 *    una escalada de privilegios por la puerta de atras — justo lo que evita
 *    que `PermisosPort` separe `puedeModerar` de `puedeConfigurar`.
 * 2. **El enlace muere solo.** Un uso y unos minutos. Un enlace ilimitado
 *    creado por una accion automatica es un agujero abierto en el grupo, y
 *    nadie se acuerda de revocarlo.
 * 3. **El permiso minimo, y explicito.** `promoteChatMember` del gateway trae
 *    por defecto `can_delete_messages` y `can_restrict_members`: si se le deja
 *    el defecto, el ayudante acaba pudiendo borrar y expulsar, que es
 *    exactamente lo que tiene prohibido. Ver `PERMISOS_DE_AUDITORIA`.
 */

/** Que se le pide al bot sobre el ayudante. */
export type MandoDeAyudante =
  | { readonly que: "activar" }
  | { readonly que: "auditoria" }
  | { readonly que: "quitar" }
  | { readonly que: "estado" }
  | { readonly que: "ayuda" };

/**
 * Los dos niveles, y por que son dos.
 *
 * Medido en produccion el 2026-09-03 con la cuenta ya conectada: el censo (180
 * personas) y las menciones (40 de 40 sin `@alias`) funcionaron con la cuenta
 * como **miembro raso**, sin un solo permiso. Solo el registro de
 * administracion y la atribucion de enlaces piden galones.
 *
 * Por eso no hay un unico botón de "dale permisos": regalaria poder que el
 * 90% de las funciones no necesita.
 */
export type NivelDeAyudante = "miembro" | "auditoria";

/**
 * Lo unico que se le concede para auditar: invitar.
 *
 * Telegram exige ser admin para leer `channels.getAdminLog`, pero no exige
 * NINGUN permiso concreto — basta con serlo. `can_invite_users` es el galon
 * mas inofensivo que existe: no deja borrar, ni expulsar, ni fijar, ni cambiar
 * el grupo, ni nombrar a nadie. Y de paso es el que hace falta para listar los
 * enlaces de invitación, que es la otra funcion de este nivel.
 *
 * Todos los demas van en `false` EXPLICITAMENTE. No se omiten: omitirlos deja
 * que el defecto del gateway los ponga en `true`.
 */
export const PERMISOS_DE_AUDITORIA = {
  can_invite_users: true,
  can_delete_messages: false,
  can_restrict_members: false,
  can_promote_members: false,
  can_change_info: false,
  can_pin_messages: false,
  can_manage_video_chats: false,
  can_manage_chat: false,
} as const;

/** Todo a false = Telegram lo degrada a miembro normal. Es como se quita. */
export const PERMISOS_PARA_DEGRADAR = {
  can_invite_users: false,
  can_delete_messages: false,
  can_restrict_members: false,
  can_promote_members: false,
  can_change_info: false,
  can_pin_messages: false,
  can_manage_video_chats: false,
  can_manage_chat: false,
} as const;

/**
 * Cuanto vive el enlace, en segundos.
 *
 * Cinco minutos: el ayudante mira su cola cada cinco segundos, asi que le
 * sobra tiempo de sobra incluso si estaba ocupado; y si algo va mal, el
 * agujero se cierra solo antes de que nadie se entere de que existio.
 */
export const SEGUNDOS_DE_VIDA_DEL_ENLACE = 300;

/** Cuanta gente puede entrar con el enlace. Uno: el ayudante y nadie mas. */
export const USOS_DEL_ENLACE = 1;

/**
 * Lee `/ayudante <que>`.
 *
 * Pura: no toca Telegram ni la base de datos. Devuelve `null` cuando el texto
 * no es este mando, para que el handler no se coma comandos ajenos.
 */
export const leerMandoDeAyudante = (texto: string): MandoDeAyudante | null => {
  const limpio = texto.trim();
  const patron = /^\/ayudante(?:@\w+)?(?:\s+(\S+))?\s*$/iu;
  const encontrado = patron.exec(limpio);
  if (!encontrado) return null;

  const que = encontrado[1]?.toLowerCase();
  if (que === undefined || que === "ayuda") return { que: "ayuda" };
  if (que === "activar") return { que: "activar" };
  if (que === "auditoria" || que === "auditoría") return { que: "auditoria" };
  if (que === "quitar") return { que: "quitar" };
  if (que === "estado") return { que: "estado" };
  return { que: "ayuda" };
};

/** El nivel que pide un mando, o `null` si el mando no mete a nadie. */
export const nivelDelMando = (
  mando: MandoDeAyudante,
): NivelDeAyudante | null => {
  if (mando.que === "activar") return "miembro";
  if (mando.que === "auditoria") return "auditoria";
  return null;
};

export const TEXTO_DE_AYUDA =
  "<b>Funciones extra del grupo</b>\n\n" +
  "<code>/ayudante activar</code> — mete al Ayudante como miembro. " +
  "Con esto ya funcionan las menciones a quien no tiene @alias y el censo " +
  "de verdad. No le da ningún permiso.\n\n" +
  "<code>/ayudante auditoria</code> — además le da UN permiso (invitar), " +
  "que es lo mínimo que Telegram exige para leer el registro de " +
  "administración. Sigue sin poder borrar, expulsar ni fijar.\n\n" +
  "<code>/ayudante quitar</code> — lo degrada y lo saca.\n" +
  "<code>/ayudante estado</code> — dice cómo está.";

export const SOLO_EL_PROPIETARIO =
  "Esto solo lo puede hacer el propietario del bot. " +
  "Meter una segunda cuenta en el grupo no es moderar.";

/** Lo que hay que hacer al pedir un alta, segun donde este ya la cuenta. */
export type AccionDeAlta = "entrar" | "promover" | "ya-esta";

/**
 * Pura: dado el estado actual de la cuenta en el grupo y el nivel que se pide,
 * dice que toca hacer.
 *
 * Existe por un fallo real: la promocion colgaba SOLO del evento de entrada, y
 * si la cuenta ya estaba dentro ese evento no vuelve a ocurrir nunca. Pedir
 * `activar` y despues `auditoria` dejaba la cuenta de miembro raso para
 * siempre, contestando "tarda unos segundos" a algo que no iba a pasar.
 *
 * `null` = no esta en el grupo. Los estados que Telegram considera "dentro"
 * son `member`, `administrator` y `creator`; `left` y `kicked` son fuera.
 */
export const decidirAlta = (
  estado: string | null,
  nivel: NivelDeAyudante,
): AccionDeAlta => {
  const dentro =
    estado === "member" || estado === "administrator" || estado === "creator";
  if (!dentro) return "entrar";
  if (nivel === "auditoria" && estado === "member") return "promover";
  return "ya-esta";
};

/**
 * Que hay que hacer cuando alguien entra en el grupo.
 *
 * Pura, y con la comprobacion de identidad dentro: es la que impide que
 * cualquiera que entre justo despues de pedir la vinculacion se lleve los
 * galones. Se compara el id, no el nombre ni el alias, que se cambian.
 */
export const decidirTrasLaEntrada = (input: {
  readonly quienEntro: bigint;
  readonly idDelAyudante: bigint;
  /** El nivel que se pidio para ESTE grupo, si se pidio alguno. */
  readonly nivelPedido: NivelDeAyudante | null;
}): { readonly promover: boolean } => {
  if (input.quienEntro !== input.idDelAyudante) return { promover: false };
  return { promover: input.nivelPedido === "auditoria" };
};
