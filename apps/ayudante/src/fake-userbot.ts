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
 * Un `UserbotPort` de mentira, para probar cada bloque sin sesión real, sin
 * red y sin `FLOOD_WAIT`. Cada método lee de un guion que el test escribe de
 * antemano — igual que los `Fake*Repository` que ya usa el resto del repo.
 */
export class FakeUserbot implements UserbotPort {
  miembros = new Map<string, readonly MiembroDelGrupo[]>();
  accessHashes = new Map<string, string>();
  fichas = new Map<string, FichaCompleta>();
  avatarHashes = new Map<string, string | null>();
  eventosAdminLog = new Map<string, readonly EventoAdminLogCrudo[]>();
  enlaces = new Map<string, readonly EnlaceInvitacionCrudo[]>();
  reacciones = new Map<string, readonly ReaccionCruda[]>();
  vistos = new Map<string, readonly bigint[]>();
  historial = new Map<string, readonly MensajeDeHistorial[]>();
  resultadoEnvioPrivado: ResultadoEnvioPrivado = { estado: "enviado" };
  latenciaMs: number | null = 42;
  pingOk = true;

  readonly enviados: { userTelegramId: bigint; texto: string }[] = [];
  readonly publicados: { canalId: bigint; texto: string }[] = [];
  readonly publicadosConMenciones: {
    chatId: bigint;
    segmentos: readonly SegmentoDeMensaje[];
  }[] = [];
  /** A quien SI se puede resolver. Lo que no este aqui sale sin enlace. */
  mencionablesResolubles = new Set<string>();
  publicarEnCanalOk = true;
  readonly unionesPedidas: string[] = [];
  readonly salidasPedidas: bigint[] = [];
  resultadoUnirse: {
    ok: boolean;
    yaDentro: boolean;
    motivo: string | null;
  } = { ok: true, yaDentro: false, motivo: null };

  private claveChat(chatId: bigint): string {
    return chatId.toString();
  }
  private claveUsuario(userId: bigint): string {
    return userId.toString();
  }

  async resolverParaMencion(input: {
    readonly chatId: bigint;
    readonly userTelegramId: bigint;
  }): Promise<{ readonly accessHash: string } | null> {
    const hash = this.accessHashes.get(this.claveUsuario(input.userTelegramId));
    return hash ? { accessHash: hash } : null;
  }

  async enviarPrivado(input: {
    readonly userTelegramId: bigint;
    readonly texto: string;
  }): Promise<ResultadoEnvioPrivado> {
    this.enviados.push(input);
    return this.resultadoEnvioPrivado;
  }

  async publicarConMenciones(input: {
    readonly chatId: bigint;
    readonly segmentos: readonly SegmentoDeMensaje[];
  }): Promise<{ readonly ok: boolean; readonly mencionesResueltas: number }> {
    this.publicadosConMenciones.push({
      chatId: input.chatId,
      segmentos: input.segmentos,
    });
    const resueltas = input.segmentos.filter(
      (s) =>
        s.tipo === "mencion" &&
        this.mencionablesResolubles.has(s.userTelegramId.toString()),
    ).length;
    return { ok: true, mencionesResueltas: resueltas };
  }

  async publicarEnCanal(input: {
    readonly canalId: bigint;
    readonly texto: string;
  }): Promise<{ readonly ok: boolean }> {
    this.publicados.push(input);
    return { ok: this.publicarEnCanalOk };
  }

  async unirseConEnlace(input: { readonly enlace: string }): Promise<{
    readonly ok: boolean;
    readonly yaDentro: boolean;
    readonly motivo: string | null;
  }> {
    this.unionesPedidas.push(input.enlace);
    return this.resultadoUnirse;
  }

  async salirDelGrupo(chatId: bigint): Promise<{ readonly ok: boolean }> {
    this.salidasPedidas.push(chatId);
    return { ok: true };
  }

  async listarMiembros(chatId: bigint): Promise<readonly MiembroDelGrupo[]> {
    return this.miembros.get(this.claveChat(chatId)) ?? [];
  }

  async obtenerFichaCompleta(userTelegramId: bigint): Promise<FichaCompleta> {
    return (
      this.fichas.get(this.claveUsuario(userTelegramId)) ?? {
        userTelegramId,
        bio: null,
        chatsEnComun: 0,
        esPremium: false,
        antiguedadEstimadaDias: null,
        tieneFoto: false,
      }
    );
  }

  async obtenerHashAvatar(userTelegramId: bigint): Promise<string | null> {
    return this.avatarHashes.get(this.claveUsuario(userTelegramId)) ?? null;
  }

  async listarEventosAdminLog(input: {
    readonly chatId: bigint;
    readonly desde: Date;
  }): Promise<readonly EventoAdminLogCrudo[]> {
    return this.eventosAdminLog.get(this.claveChat(input.chatId)) ?? [];
  }

  async listarEnlacesInvitacion(
    chatId: bigint,
  ): Promise<readonly EnlaceInvitacionCrudo[]> {
    return this.enlaces.get(this.claveChat(chatId)) ?? [];
  }

  async listarReacciones(input: {
    readonly chatId: bigint;
    readonly messageId: number;
  }): Promise<readonly ReaccionCruda[]> {
    return this.reacciones.get(`${input.chatId}:${input.messageId}`) ?? [];
  }

  async listarVistos(input: {
    readonly chatId: bigint;
    readonly messageId: number;
  }): Promise<readonly bigint[]> {
    return this.vistos.get(`${input.chatId}:${input.messageId}`) ?? [];
  }

  async buscarEnHistorial(input: {
    readonly chatId: bigint;
    readonly texto: string | null;
    readonly deUsuario: bigint | null;
    readonly limite: number;
  }): Promise<readonly MensajeDeHistorial[]> {
    const todos = this.historial.get(this.claveChat(input.chatId)) ?? [];
    return todos
      .filter(
        (m) =>
          (input.deUsuario === null || m.userTelegramId === input.deUsuario) &&
          (input.texto === null ||
            m.texto.toLowerCase().includes(input.texto.toLowerCase())),
      )
      .slice(0, input.limite);
  }

  async ping(
    _chatId: bigint,
  ): Promise<{ readonly ok: boolean; readonly latenciaMs: number | null }> {
    return { ok: this.pingOk, latenciaMs: this.latenciaMs };
  }
}
