import { readFileSync } from "node:fs";
import bigInt from "big-integer";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { extraerHashDeInvitacion } from "./bloques/vinculacion.js";
import type { AyudanteEnv } from "./env.js";
import type {
  EnlaceInvitacionCrudo,
  EventoAdminLogCrudo,
  FichaCompleta,
  MensajeDeHistorial,
  MiembroDelGrupo,
  ReaccionCruda,
  ResultadoEnvioPrivado,
  SegmentoDeMensaje,
  UserbotPort,
} from "./userbot-port.js";

/**
 * La implementación real de `UserbotPort` sobre GramJS (MTProto).
 *
 * Lo que este fichero NO hace, y no por olvido (ver `docs/PLAN-AYUDANTE.md`):
 * no descarga fotos ni vídeos, no lee localización, no resuelve números de
 * teléfono, no entra en chats fuera del perímetro de Modryva, no suplanta a
 * nadie, y **no modera** — no hay un solo `EditBanned`, `DeleteMessages` ni
 * equivalente en todo el fichero. Eso lo hace el bot, que tiene auditoría y
 * `PermisosPort`.
 */

/** Cuánto se espera como mucho a que el bot conteste un ping, en ms. */
const TIMEOUT_PING_MS = 15_000;
/** Cada cuánto se mira si ya contestó. */
const INTERVALO_PING_MS = 750;

/**
 * Por debajo de este `FLOOD_WAIT` (en segundos) GramJS espera solo y
 * reintenta; por encima lanza y la solicitud se reintenta más tarde por la
 * cola. Sesenta segundos es el corte razonable: dormir un minuto dentro de un
 * manejador es aceptable, dormir media hora bloquea la cola entera.
 */
const UMBRAL_FLOOD_SEGUNDOS = 60;

const dormir = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Lee la sesión de la variable de entorno o del fichero, en ese orden. */
const leerSesion = (env: AyudanteEnv): string => {
  if (env.AYUDANTE_SESSION) return env.AYUDANTE_SESSION.trim();
  const ruta = env.AYUDANTE_SESSION_PATH;
  if (!ruta) throw new Error("no hay sesión configurada para el ayudante");
  try {
    return readFileSync(ruta, "utf8").trim();
  } catch (error) {
    throw new Error(
      `no he podido leer la sesión del ayudante en "${ruta}". ` +
        "Genérala con apps/ayudante/src/login.ts. " +
        `Causa: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * De `status` de Telegram a una fecha de última conexión, cuando la privacidad
 * de esa persona la deja ver. `UserStatusRecently`, `LastWeek` y `LastMonth`
 * son deliberadamente imprecisos y se tratan como "no se sabe": inventar una
 * fecha a partir de ellos sería fabricar un dato que Telegram se niega a dar.
 */
const ultimaConexionDe = (estado: unknown): Date | null => {
  if (estado instanceof Api.UserStatusOnline) return new Date();
  if (estado instanceof Api.UserStatusOffline) {
    return new Date(estado.wasOnline * 1000);
  }
  return null;
};

/**
 * El id numérico de un `Peer`.
 *
 * `Peer` es un envoltorio (`PeerUser`, `PeerChat`, `PeerChannel`), no un
 * número: hacerle `.toString()` typechequea y devuelve la representación del
 * objeto, no el id. Hay que sacar el campo que toque en cada variante.
 */
const idDePeer = (peer: Api.TypePeer): bigint | null => {
  if (peer instanceof Api.PeerUser) return BigInt(peer.userId.toString());
  if (peer instanceof Api.PeerChat) return BigInt(peer.chatId.toString());
  if (peer instanceof Api.PeerChannel) return BigInt(peer.channelId.toString());
  return null;
};

const nombreDe = (usuario: Api.User): string | null => {
  const partes = [usuario.firstName, usuario.lastName].filter(
    (parte): parte is string => typeof parte === "string" && parte.length > 0,
  );
  return partes.length > 0 ? partes.join(" ") : null;
};

export class GramjsUserbot implements UserbotPort {
  private readonly cliente: TelegramClient;

  constructor(env: AyudanteEnv) {
    this.cliente = new TelegramClient(
      new StringSession(leerSesion(env)),
      env.AYUDANTE_API_ID,
      env.AYUDANTE_API_HASH,
      {
        connectionRetries: 5,
        floodSleepThreshold: UMBRAL_FLOOD_SEGUNDOS,
        // El ayudante no atiende updates: solo pregunta y escribe cuando la
        // cola se lo pide. Sin esto GramJS abre el bucle de updates y recibe
        // todo el tráfico de la cuenta para nada.
        useWSS: false,
      },
    );
  }

  /** Conecta con la sesión ya existente. NUNCA pide teléfono ni código: eso es `login.ts`, y lo ejecuta una persona. */
  async conectar(): Promise<void> {
    await this.cliente.connect();
    if (!(await this.cliente.isUserAuthorized())) {
      throw new Error(
        "la sesión del ayudante no está autorizada: vuelve a generarla con apps/ayudante/src/login.ts",
      );
    }
  }

  async desconectar(): Promise<void> {
    await this.cliente.destroy();
  }

  async resolverParaMencion(input: {
    readonly chatId: bigint;
    readonly userTelegramId: bigint;
  }): Promise<{ readonly accessHash: string } | null> {
    try {
      const entidad = await this.cliente.getInputEntity(
        Number(input.userTelegramId),
      );
      if (entidad instanceof Api.InputPeerUser) {
        return { accessHash: entidad.accessHash.toString() };
      }
      return null;
    } catch {
      // Sin `access_hash` no hay mención posible ni para una cuenta de
      // usuario. Es un resultado válido, no un fallo: quien encoló la
      // solicitud cae a mencionar solo por nombre.
      return null;
    }
  }

  async enviarPrivado(input: {
    readonly userTelegramId: bigint;
    readonly texto: string;
  }): Promise<ResultadoEnvioPrivado> {
    try {
      await this.cliente.sendMessage(Number(input.userTelegramId), {
        message: input.texto,
      });
      return { estado: "enviado" };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      // Que alguien te tenga bloqueado, o tenga los privados cerrados, no es
      // un fallo del ayudante: es una respuesta. Se distingue de un fallo de
      // red porque esos SÍ deben reintentarse, y por eso se relanzan.
      if (
        mensaje.includes("USER_IS_BLOCKED") ||
        mensaje.includes("USER_PRIVACY_RESTRICTED") ||
        mensaje.includes("PEER_ID_INVALID") ||
        mensaje.includes("YOU_BLOCKED_USER")
      ) {
        return { estado: "bloqueado" };
      }
      if (
        mensaje.includes("USER_DEACTIVATED") ||
        mensaje.includes("USER_BANNED")
      ) {
        return { estado: "rebotado" };
      }
      throw error;
    }
  }

  /**
   * Monta el mensaje y sus entidades de mención, y lo publica.
   *
   * Dos cosas que hay que hacer bien o no funciona:
   *
   * 1. **Los offsets van en UTF-16**, que es como los cuenta Telegram, y es
   *    justo lo que devuelve `String.length` en JavaScript. Contar en bytes o
   *    en puntos de código desplaza la mención y el enlace acaba encima de
   *    otra palabra — con emojis, que ocupan dos, se ve enseguida.
   * 2. **A quien no se resuelve se le escribe el nombre sin enlace.** Perder
   *    el enlace de uno es mucho mejor que perder el mensaje entero, que es lo
   *    que pasaria si esto lanzara.
   */
  async publicarConMenciones(input: {
    readonly chatId: bigint;
    readonly segmentos: readonly SegmentoDeMensaje[];
  }): Promise<{ readonly ok: boolean; readonly mencionesResueltas: number }> {
    let texto = "";
    const entidades: Api.TypeMessageEntity[] = [];
    let resueltas = 0;

    // Calentar la cache ANTES de resolver, y una sola vez.
    //
    // MTProto no deja resolver un id de usuario a secas: hace falta su
    // `access_hash`, y eso solo llega habiendo visto a esa persona en algun
    // sitio. Con el proceso recien arrancado la cache esta vacia, asi que
    // `getInputEntity` falla y la mencion sale sin enlace — justo lo que se
    // venia a arreglar. Listar los miembros del grupo llena la cache de todos
    // de golpe, que es lo que hacia que funcionara al probarlo a mano.
    //
    // Se hace solo si hay alguna mencion que resolver: un mensaje sin
    // menciones no tiene por que pagar un `getParticipants`.
    if (input.segmentos.some((s) => s.tipo === "mencion")) {
      try {
        await this.cliente.getParticipants(Number(input.chatId), {});
      } catch {
        // Si no se puede listar (no es miembro, o es un canal), se sigue: a
        // quien no se resuelva se le escribe el nombre sin enlace.
      }
    }

    for (const segmento of input.segmentos) {
      if (segmento.tipo === "texto") {
        texto += segmento.valor;
        continue;
      }

      const id = Number(segmento.userTelegramId);
      let nombre = segmento.userTelegramId.toString();
      let entidad: Api.InputPeerUser | null = null;
      try {
        const usuario = await this.cliente.getEntity(id);
        if (usuario instanceof Api.User) {
          nombre = nombreDe(usuario) ?? usuario.username ?? nombre;
        }
        const input2 = await this.cliente.getInputEntity(id);
        if (input2 instanceof Api.InputPeerUser) entidad = input2;
      } catch {
        // Sin acceso a esa persona no hay mencion posible. Se escribe su id y
        // se sigue: el resto del mensaje vale igual.
      }

      const offset = texto.length;
      texto += nombre;
      if (entidad) {
        entidades.push(
          new Api.InputMessageEntityMentionName({
            offset,
            length: nombre.length,
            // `InputUser` y no `InputPeerUser`: la entidad de mencion pide el
            // usuario, no el peer. Llevan los mismos dos campos y por eso el
            // error solo lo caza el typecheck, nunca la lectura.
            userId: new Api.InputUser({
              userId: entidad.userId,
              accessHash: entidad.accessHash,
            }),
          }),
        );
        resueltas += 1;
      }
    }

    if (texto.trim().length === 0) {
      return { ok: false, mencionesResueltas: 0 };
    }

    await this.cliente.sendMessage(Number(input.chatId), {
      message: texto,
      formattingEntities: entidades,
    });
    return { ok: true, mencionesResueltas: resueltas };
  }

  async publicarEnCanal(input: {
    readonly canalId: bigint;
    readonly texto: string;
  }): Promise<{ readonly ok: boolean }> {
    const entidad = await this.cliente.getEntity(Number(input.canalId));
    await this.cliente.sendMessage(entidad, { message: input.texto });
    return { ok: true };
  }

  async unirseConEnlace(input: { readonly enlace: string }): Promise<{
    readonly ok: boolean;
    readonly yaDentro: boolean;
    readonly motivo: string | null;
  }> {
    const hash = extraerHashDeInvitacion(input.enlace);
    if (hash === null) {
      return { ok: false, yaDentro: false, motivo: "enlace no reconocido" };
    }

    try {
      await this.cliente.invoke(new Api.messages.ImportChatInvite({ hash }));
      return { ok: true, yaDentro: false, motivo: null };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      // Ya ser miembro es el resultado que se buscaba, no un fallo: tratarlo
      // como error haria que un reintento pareciera roto.
      if (mensaje.includes("USER_ALREADY_PARTICIPANT")) {
        return { ok: true, yaDentro: true, motivo: null };
      }
      // Estos tres NO se reintentan: el enlace ya no sirve y volver a
      // intentarlo con una cuenta de usuario es justo lo que Telegram castiga.
      if (
        mensaje.includes("INVITE_HASH_EXPIRED") ||
        mensaje.includes("INVITE_HASH_INVALID") ||
        mensaje.includes("USERS_TOO_MUCH")
      ) {
        return { ok: false, yaDentro: false, motivo: mensaje.slice(0, 80) };
      }
      throw error;
    }
  }

  async salirDelGrupo(chatId: bigint): Promise<{ readonly ok: boolean }> {
    // `leaveChat` de GramJS resuelve la entidad y manda el `LeaveChannel`
    // correspondiente. No borra el historial de nadie: solo se va.
    await this.cliente.invoke(
      new Api.channels.LeaveChannel({ channel: Number(chatId) }),
    );
    return { ok: true };
  }

  async listarMiembros(chatId: bigint): Promise<readonly MiembroDelGrupo[]> {
    const participantes = await this.cliente.getParticipants(
      Number(chatId),
      {},
    );
    return participantes
      .filter((usuario): usuario is Api.User => usuario instanceof Api.User)
      .filter((usuario) => usuario.bot !== true)
      .map((usuario) => ({
        userTelegramId: BigInt(usuario.id.toString()),
        alias: usuario.username ?? null,
        nombre: nombreDe(usuario),
        ultimaConexionEn: ultimaConexionDe(usuario.status),
      }));
  }

  async obtenerFichaCompleta(userTelegramId: bigint): Promise<FichaCompleta> {
    const completo = await this.cliente.invoke(
      new Api.users.GetFullUser({ id: Number(userTelegramId) }),
    );
    const ficha = completo.fullUser;
    const usuario = completo.users.find(
      (u): u is Api.User => u instanceof Api.User,
    );

    return {
      userTelegramId,
      bio: ficha.about ?? null,
      chatsEnComun: ficha.commonChatsCount ?? 0,
      esPremium: usuario?.premium === true,
      // Telegram no publica la fecha de alta de una cuenta. Estimarla por el
      // id son heurísticas que envejecen mal, y una antigüedad inventada
      // alimentaría directamente la puntuación de riesgo de ingreso. `null`
      // ya está contemplado ahí y pesa como incertidumbre, no como señal.
      antiguedadEstimadaDias: null,
      tieneFoto: ficha.profilePhoto !== undefined,
    };
  }

  /**
   * El identificador de la foto de perfil actual, no un hash de su contenido.
   *
   * Hashear la imagen exigiría descargarla, y `docs/PLAN-AYUDANTE.md` prohíbe
   * que el ayudante toque fotos. Con esto se detecta el historial de avatares
   * de una cuenta y las cuentas que comparten LA MISMA foto subida (reenviada
   * o copiada dentro de Telegram), que es el caso habitual de las granjas de
   * cuentas. NO detecta dos subidas distintas de una imagen idéntica: eso
   * necesitaría contenido, y es una decisión que tiene que tomar el
   * propietario a sabiendas.
   */
  async obtenerHashAvatar(userTelegramId: bigint): Promise<string | null> {
    const completo = await this.cliente.invoke(
      new Api.users.GetFullUser({ id: Number(userTelegramId) }),
    );
    const foto = completo.fullUser.profilePhoto;
    if (!foto || !("id" in foto)) return null;
    return foto.id.toString();
  }

  async listarEventosAdminLog(input: {
    readonly chatId: bigint;
    readonly desde: Date;
  }): Promise<readonly EventoAdminLogCrudo[]> {
    const resultado = await this.cliente.invoke(
      new Api.channels.GetAdminLog({
        channel: Number(input.chatId),
        q: "",
        // `long` en GramJS es `big-integer`, NO el `bigint` nativo: pasar
        // `0n` typechequea con un cast y revienta al serializar.
        maxId: bigInt(0),
        minId: bigInt(0),
        limit: 100,
      }),
    );

    const desdeSegundos = Math.floor(input.desde.getTime() / 1000);
    return resultado.events
      .filter((evento) => evento.date >= desdeSegundos)
      .map((evento) => ({
        telegramEventId: evento.id.toString(),
        accion: evento.action.className,
        actorTelegramId: BigInt(evento.userId.toString()),
        objetivoTelegramId: null,
        detalle: { accion: evento.action.className },
        ocurrioEn: new Date(evento.date * 1000),
      }));
  }

  /**
   * Los enlaces de invitación de un grupo, recorriendo sus administradores.
   *
   * `messages.getExportedChatInvites` exige un `adminId`: no existe un "dame
   * todos". Por eso se listan primero los admins y se pregunta por cada uno.
   */
  async listarEnlacesInvitacion(
    chatId: bigint,
  ): Promise<readonly EnlaceInvitacionCrudo[]> {
    const canal = Number(chatId);
    const admins = await this.cliente.getParticipants(canal, {
      filter: new Api.ChannelParticipantsAdmins(),
    });

    const enlaces: EnlaceInvitacionCrudo[] = [];
    for (const admin of admins) {
      const resultado = await this.cliente.invoke(
        new Api.messages.GetExportedChatInvites({
          peer: canal,
          adminId: Number(admin.id.toString()),
          limit: 100,
        }),
      );
      for (const invitacion of resultado.invites) {
        if (!(invitacion instanceof Api.ChatInviteExported)) continue;
        enlaces.push({
          enlaceId: invitacion.link,
          creadorTelegramId: BigInt(admin.id.toString()),
          usosTotal: invitacion.usage ?? 0,
        });
      }
    }
    return enlaces;
  }

  async listarReacciones(input: {
    readonly chatId: bigint;
    readonly messageId: number;
  }): Promise<readonly ReaccionCruda[]> {
    const resultado = await this.cliente.invoke(
      new Api.messages.GetMessageReactionsList({
        peer: Number(input.chatId),
        id: input.messageId,
        limit: 100,
      }),
    );

    return resultado.reactions.flatMap((reaccion) => {
      const emoji =
        reaccion.reaction instanceof Api.ReactionEmoji
          ? reaccion.reaction.emoticon
          : null;
      const userTelegramId = idDePeer(reaccion.peerId);
      // Sin emoji (una reacción de emoji personalizado) o sin peer legible no
      // hay nada que devolver: se omite en vez de inventar un cero.
      if (emoji === null || userTelegramId === null) return [];
      return [{ userTelegramId, emoji }];
    });
  }

  async listarVistos(input: {
    readonly chatId: bigint;
    readonly messageId: number;
  }): Promise<readonly bigint[]> {
    // Telegram solo lo da en grupos de menos de 100 miembros. En los grandes
    // devuelve error, y ahí "no se sabe" es la respuesta honesta.
    try {
      const resultado = await this.cliente.invoke(
        new Api.messages.GetMessageReadParticipants({
          peer: Number(input.chatId),
          msgId: input.messageId,
        }),
      );
      return resultado.map((lector) => BigInt(lector.userId.toString()));
    } catch {
      return [];
    }
  }

  /**
   * Busca en el historial del grupo. **Solo texto**: los mensajes sin texto se
   * descartan aquí, y `MensajeDeHistorial` no tiene ningún campo de media.
   */
  async buscarEnHistorial(input: {
    readonly chatId: bigint;
    readonly texto: string | null;
    readonly deUsuario: bigint | null;
    readonly limite: number;
  }): Promise<readonly MensajeDeHistorial[]> {
    const mensajes = await this.cliente.getMessages(Number(input.chatId), {
      limit: input.limite,
      ...(input.texto !== null ? { search: input.texto } : {}),
      ...(input.deUsuario !== null
        ? { fromUser: Number(input.deUsuario) }
        : {}),
    });

    return mensajes.flatMap((mensaje) => {
      const texto = mensaje.message;
      if (typeof texto !== "string" || texto.length === 0) return [];
      const autor = mensaje.senderId;
      if (!autor) return [];
      return [
        {
          messageId: mensaje.id,
          userTelegramId: BigInt(autor.toString()),
          texto,
          fecha: new Date(mensaje.date * 1000),
          // El historial solo tiene lo que sigue existiendo: un borrado no
          // deja rastro aquí. Quien quiera saber si lo borró un admin cruza
          // esto con el admin log (ver `bloques/moderacion.ts`).
          borradoPorAdmin: false,
        },
      ];
    });
  }

  /**
   * Mide cuánto tarda **el bot** en contestar, no cuánto tarda Telegram.
   *
   * Manda `/ping` al chat y espera a que aparezca un mensaje nuevo de un bot.
   * Medir un `Api.Ping` de MTProto habría sido mucho más simple y habría
   * medido la cosa equivocada: la salud de la conexión de ESTA cuenta, no la
   * del proceso que modera. Un watchdog que mide lo que no es, miente.
   */
  async ping(
    chatId: bigint,
  ): Promise<{ readonly ok: boolean; readonly latenciaMs: number | null }> {
    const chat = Number(chatId);
    const arranque = Date.now();
    const enviado = await this.cliente.sendMessage(chat, { message: "/ping" });

    while (Date.now() - arranque < TIMEOUT_PING_MS) {
      await dormir(INTERVALO_PING_MS);
      const nuevos = await this.cliente.getMessages(chat, {
        limit: 10,
        minId: enviado.id,
      });
      const respuestaDeBot = nuevos.find(
        (mensaje) =>
          mensaje.id > enviado.id &&
          mensaje.sender instanceof Api.User &&
          mensaje.sender.bot === true,
      );
      if (respuestaDeBot) {
        return { ok: true, latenciaMs: Date.now() - arranque };
      }
    }

    return { ok: false, latenciaMs: null };
  }
}
