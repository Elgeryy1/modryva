import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  type EconomyRepository,
  type PetRepository,
  PrismaChatSettingRepository,
  PrismaEconomyRepository,
  PrismaFoundationRepository,
  PrismaPetRepository,
  prisma,
} from "@superbot/data";
import {
  abrirHuevo,
  alimentar,
  animoTrasJugar,
  aplicarPasoDelTiempo,
  caraDe,
  commit,
  ESPECIES,
  esEspecieId,
  esRasgoId,
  JUGUETES_POR_DIA,
  type Juguete,
  newServerSeed,
  PETS_SETTINGS_KEY,
  parsearAjustes,
  progresoDeNivel,
  RASGOS,
  type RasgoId,
  sumarXp,
  usarJuguete,
  XP_POR_JUEGO,
  XP_POR_RACION,
} from "@superbot/module-games";
import { decodeStartParam, getRuntimeEnv } from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";
import { resolveGroupForCaller } from "../games/group-binding.js";

/**
 * Las mascotas vistas desde la Mini App.
 *
 * Misma disciplina que la tienda: el `start_param` lo elige quien construye el
 * enlace, asi que la firma de Telegram prueba que la llamada paso por esta Mini
 * App, **no** que quien llama tenga nada que ver con ese grupo. Sin la
 * comprobacion de pertenencia, abrir `?startapp=pet_<grupo_ajeno>` bastaria
 * para dar de comer con las monedas de otro sitio.
 *
 * El retrato viaja como RUTA de imagen, no como dibujo. Es lo que evita que la
 * Mini App tenga que conocer el catalogo de especies para pintar un bicho.
 */
@Injectable()
export class PetsService {
  constructor(
    private readonly foundation = new PrismaFoundationRepository(),
    private readonly chatSettings = new PrismaChatSettingRepository(),
    private readonly economy: EconomyRepository = new PrismaEconomyRepository(),
    private readonly pets: PetRepository = new PrismaPetRepository(),
    private readonly gateway = new HttpTelegramGateway(),
    private readonly client = prisma,
  ) {}

  private async tenantId(bot: { username?: string }): Promise<string> {
    const botKey = (bot.username ?? getRuntimeEnv().TELEGRAM_BOT_USERNAME)
      .replace(/^@/u, "")
      .toLowerCase();
    const tenant = await this.client.tenant.findUnique({
      where: { slug: `telegram-${botKey}` },
    });
    if (!tenant) {
      throw new ServiceUnavailableException({ error: "no-tenant" });
    }
    return tenant.id;
  }

  /** Resuelve el grupo del enlace y comprueba que quien abre esta dentro. */
  private async scope(
    startParam: string | null,
    userId: string,
    bot: { token?: string; username?: string } = {},
  ): Promise<{ tenantId: string; chatId: string; usuario: bigint }> {
    const decoded = decodeStartParam(startParam);
    if (decoded?.kind !== "pet" || !decoded.groupId) {
      throw new ForbiddenException({ error: "not-a-group" });
    }
    const tenantId = await this.tenantId(bot);
    const chat = await resolveGroupForCaller(
      { foundation: this.foundation, gateway: this.gateway },
      {
        tenantId,
        telegramChatId: BigInt(decoded.groupId),
        telegramUserId: BigInt(userId),
        token: bot.token ?? getRuntimeEnv().TELEGRAM_BOT_TOKEN,
      },
    );
    if (!chat) {
      throw new ForbiddenException({ error: "not-in-a-group" });
    }
    return { tenantId, chatId: chat.chatId, usuario: BigInt(userId) };
  }

  private async ajustesDe(tenantId: string, chatId: string) {
    return parsearAjustes(
      await this.chatSettings
        .getValue(tenantId, chatId, PETS_SETTINGS_KEY)
        .catch(() => undefined),
    );
  }

  /**
   * La pantalla entera: el bicho, el saldo y el corral.
   *
   * Una sola llamada y no tres porque la pantalla no sirve de nada a medias: el
   * bicho sin el saldo no puede decir si se le puede dar de comer.
   */
  async view(
    startParam: string | null,
    userId: string,
    ahoraMs: number,
    bot: { token?: string; username?: string } = {},
  ) {
    const { tenantId, chatId, usuario } = await this.scope(
      startParam,
      userId,
      bot,
    );
    const ajustes = await this.ajustesDe(tenantId, chatId);
    const ahora = new Date(ahoraMs);

    const [fila, cartera, corral] = await Promise.all([
      this.pets.obtener(tenantId, chatId, usuario),
      this.economy.getWallet(tenantId, chatId, usuario),
      this.pets.corral(tenantId, chatId, 20),
    ]);

    const dia = ahora.toISOString().slice(0, 10);
    const mia = fila ? this.aDto(fila, ahora, dia) : null;

    return {
      activo: ajustes.activo,
      saldo: cartera?.balance ?? 0,
      precioRacion: ajustes.precioRacion,
      racionesPorDia: ajustes.racionesPorDia,
      precioHuevo: ajustes.primerHuevoGratis ? 0 : ajustes.precioHuevo,
      mia,
      corral: corral.flatMap((otra) => {
        const dto = this.aDto(otra, ahora, dia);
        return dto ? [{ ...dto, esMia: otra.userTelegramId === usuario }] : [];
      }),
    };
  }

  /** Da una racion. Cobra y llena, o no hace ninguna de las dos cosas. */
  async feed(
    startParam: string | null,
    userId: string,
    ahoraMs: number,
    bot: { token?: string; username?: string } = {},
  ) {
    const { tenantId, chatId, usuario } = await this.scope(
      startParam,
      userId,
      bot,
    );
    const ajustes = await this.ajustesDe(tenantId, chatId);
    if (!ajustes.activo) {
      throw new ForbiddenException({ error: "apagado" });
    }

    const ahora = new Date(ahoraMs);
    const dia = ahora.toISOString().slice(0, 10);
    const fila = await this.pets.obtener(tenantId, chatId, usuario);
    if (!fila || !esEspecieId(fila.especie)) {
      throw new ForbiddenException({ error: "sin-mascota" });
    }

    const rasgos = fila.rasgos.filter((id): id is RasgoId => esRasgoId(id));
    const estado = aplicarPasoDelTiempo(
      {
        hambre: fila.hambre,
        animo: fila.animo,
        nivel: fila.nivel,
        xp: fila.xp,
      },
      ahora.getTime() - fila.vistaEn.getTime(),
      rasgos,
    );
    const cartera = await this.economy.getWallet(tenantId, chatId, usuario);
    const decision = alimentar({
      estado,
      saldo: cartera?.balance ?? 0,
      racionesHoy: fila.racionesDia === dia ? fila.racionesHoy : 0,
      rasgos,
      precioRacion: ajustes.precioRacion,
      racionesPorDia: ajustes.racionesPorDia,
    });
    if (!decision.ok) {
      return { ok: false as const, motivo: decision.motivo };
    }

    // La MISMA XP que por el chat. Si la Mini App alimentara sin dar
    // experiencia, la mascota subiria o no segun por donde se le diera de
    // comer, y eso es media feature con una regla y media con otra.
    const subida = sumarXp(decision.estado, XP_POR_RACION);

    const servida = await this.pets.servirRacion({
      id: fila.id,
      tenantId,
      chatId,
      userTelegramId: usuario,
      coste: decision.coste,
      hambreNueva: decision.estado.hambre,
      xpNueva: subida.estado.xp,
      nivelNuevo: subida.nivel,
      diaUtc: dia,
    });
    if (!servida.ok) {
      return { ok: false as const, motivo: "sinSaldo" as const };
    }
    return {
      ok: true as const,
      progreso: {
        xpGanada: subida.ganada,
        nivel: subida.nivel,
        haSubido: subida.haSubido,
        evoluciona: subida.evoluciona,
      },
      saldo: servida.saldo,
      coste: decision.coste,
      racionesHoy: servida.racionesHoy,
    };
  }

  /**
   * Jugar con ella desde la Mini App: gratis, una vez al dia, sube el animo.
   *
   * Mismo camino que `/jugar` en el chat y misma guarda —la del dia vive en el
   * `updateMany` del repositorio—, asi que abrir la app y escribir el comando a
   * la vez sigue subiendo el animo UNA vez.
   *
   * El animo se calcula sobre el estado ya envejecido, no sobre el guardado:
   * sumarle quince al de la fila le regalaria las horas que lleva sin mirarse.
   */
  async play(
    startParam: string | null,
    userId: string,
    ahoraMs: number,
    bot: { token?: string; username?: string } = {},
  ) {
    const { tenantId, chatId, usuario } = await this.scope(
      startParam,
      userId,
      bot,
    );
    const ajustes = await this.ajustesDe(tenantId, chatId);
    if (!ajustes.activo) {
      throw new ForbiddenException({ error: "apagado" });
    }

    const ahora = new Date(ahoraMs);
    const dia = ahora.toISOString().slice(0, 10);
    const fila = await this.pets.obtener(tenantId, chatId, usuario);
    if (!fila || !esEspecieId(fila.especie)) {
      throw new ForbiddenException({ error: "sin-mascota" });
    }

    const rasgos = fila.rasgos.filter((id): id is RasgoId => esRasgoId(id));
    const estado = aplicarPasoDelTiempo(
      {
        hambre: fila.hambre,
        animo: fila.animo,
        nivel: fila.nivel,
        xp: fila.xp,
      },
      ahora.getTime() - fila.vistaEn.getTime(),
      rasgos,
    );

    // La XP va en el mismo `updateMany` que la marca del dia, igual que por el
    // chat: en dos escrituras, el segundo toque del dia no subiria el animo
    // pero si podria volver a sumar experiencia.
    const ganada = sumarXp(estado, XP_POR_JUEGO);

    const jugado = await this.pets.jugar({
      id: fila.id,
      animoNuevo: animoTrasJugar(estado.animo),
      xpNueva: ganada.estado.xp,
      nivelNuevo: ganada.nivel,
      diaUtc: dia,
    });
    if (!jugado.ok) {
      return { ok: false as const, motivo: "yaHoy" as const };
    }
    return {
      ok: true as const,
      animo: jugado.animo,
      subida: jugado.animo - estado.animo,
      progreso: {
        xpGanada: ganada.ganada,
        nivel: ganada.nivel,
        haSubido: ganada.haSubido,
        evoluciona: ganada.evoluciona,
      },
    };
  }

  /**
   * Darle un juguete, ya con el grupo resuelto.
   *
   * Lo llama la TIENDA y no la pantalla de mascotas: los juguetes se compran,
   * asi que quien cobra es quien tiene que aplicarlos. Por eso recibe el
   * ambito ya resuelto en vez de un `startParam` — el cobro ya lo miro.
   *
   * Gemelo de `darJuguete` en el bot, y la duplicacion es la que este repo ya
   * acepta para mascotas: la decision es pura y esta compartida, pero la
   * orquestacion necesita el repositorio, y un modulo no puede tocarlo.
   */
  async darJuguete(input: {
    tenantId: string;
    chatId: string;
    usuario: bigint;
    juguete: Juguete;
    ahora: Date;
  }): Promise<
    | { ok: true; animo: number; subida: number }
    | { ok: false; motivo: "sinMascota" | "topeDiario" | "yaLlena" }
  > {
    const fila = await this.pets.obtener(
      input.tenantId,
      input.chatId,
      input.usuario,
    );
    if (!fila) {
      return { ok: false, motivo: "sinMascota" };
    }
    const dia = input.ahora.toISOString().slice(0, 10);
    const rasgos = fila.rasgos.filter((id): id is RasgoId => esRasgoId(id));
    const estado = aplicarPasoDelTiempo(
      {
        hambre: fila.hambre,
        animo: fila.animo,
        nivel: fila.nivel,
        xp: fila.xp,
      },
      input.ahora.getTime() - fila.vistaEn.getTime(),
      rasgos,
    );
    const decision = usarJuguete({
      juguete: input.juguete,
      animo: estado.animo,
      usadosHoy: fila.juguetesDia === dia ? fila.juguetesHoy : 0,
    });
    if (!decision.ok) {
      return { ok: false, motivo: decision.motivo };
    }
    const gastado = await this.pets.usarJuguete({
      id: fila.id,
      animoNuevo: decision.animo,
      diaUtc: dia,
      topeDiario: JUGUETES_POR_DIA,
    });
    return gastado.ok
      ? { ok: true, animo: gastado.animo, subida: decision.subida }
      : { ok: false, motivo: "topeDiario" };
  }

  /** Consigue el primer bicho. */
  async hatch(
    startParam: string | null,
    userId: string,
    ahoraMs: number,
    bot: { token?: string; username?: string } = {},
  ) {
    const { tenantId, chatId, usuario } = await this.scope(
      startParam,
      userId,
      bot,
    );
    const ajustes = await this.ajustesDe(tenantId, chatId);
    if (!ajustes.activo) {
      throw new ForbiddenException({ error: "apagado" });
    }
    if (await this.pets.obtener(tenantId, chatId, usuario)) {
      return { ok: false as const, motivo: "yaTiene" as const };
    }

    const precio = ajustes.primerHuevoGratis ? 0 : ajustes.precioHuevo;
    const cartera = await this.economy.getWallet(tenantId, chatId, usuario);
    if (precio > 0 && (cartera?.balance ?? 0) < precio) {
      return { ok: false as const, motivo: "sinSaldo" as const, precio };
    }

    const serverSeed = newServerSeed();
    const eclosion = abrirHuevo({
      tipo: "basico",
      serverSeed,
      clientSeed: `${usuario}`,
      nonce: 0,
    });
    if (!eclosion) {
      throw new ServiceUnavailableException({ error: "sin-catalogo" });
    }

    if (precio > 0) {
      const cobro = await this.economy.debit(
        tenantId,
        chatId,
        usuario,
        precio,
        "pet-egg",
      );
      if (!cobro.ok) {
        return { ok: false as const, motivo: "sinSaldo" as const, precio };
      }
    }

    await this.pets.crear({
      tenantId,
      chatId,
      userTelegramId: usuario,
      especie: eclosion.especie,
      rasgos: eclosion.rasgos,
      ahora: new Date(ahoraMs),
      serverSeed,
      serverSeedHash: commit(serverSeed),
      clientSeed: `${usuario}`,
    });

    return {
      ok: true as const,
      especie: eclosion.especie,
      gratis: precio === 0,
    };
  }

  /**
   * De la fila al DTO de la pantalla, con el tiempo ya aplicado.
   *
   * El retrato viaja compuesto para que la Mini App no tenga que conocer el
   * catalogo. Devuelve `null` si la especie ya no existe: mejor no enseñar el
   * bicho que enseñar uno roto.
   */
  private aDto(
    fila: Awaited<ReturnType<PetRepository["obtener"]>> & object,
    ahora: Date,
    dia: string,
  ) {
    if (!esEspecieId(fila.especie)) {
      return null;
    }
    const rasgos = fila.rasgos.filter((id): id is RasgoId => esRasgoId(id));
    const estado = aplicarPasoDelTiempo(
      {
        hambre: fila.hambre,
        animo: fila.animo,
        nivel: fila.nivel,
        xp: fila.xp,
      },
      ahora.getTime() - fila.vistaEn.getTime(),
      rasgos,
    );
    const especie = ESPECIES[fila.especie];
    const cara = caraDe(estado);
    return {
      especie: fila.especie,
      nombreEspecie: especie.nombre,
      descripcion: especie.descripcion,
      familia: especie.familia,
      glifo: especie.glifo,
      nombre: fila.nombre,
      cara,
      // La ruta del sprite, no el dibujo. Los PNG los recorta
      // `scripts/recortar-mascotas.mjs` de una hoja generada, y viven en
      // `apps/web/public/mascotas`. Antes aqui se componia un SVG por codigo y
      // el resultado era el mismo circulo con orejas seis veces: lo unico que
      // cambiaba entre un buho y un zorro era el color.
      retrato: `/mascotas/${fila.especie}.png`,
      hambre: Math.round(estado.hambre),
      animo: Math.round(estado.animo),
      nivel: estado.nivel,
      progreso: Math.round(progresoDeNivel(estado) * 100),
      rasgos: rasgos.map((id) => RASGOS[id].nombre),
      racionesHoy: fila.racionesDia === dia ? fila.racionesHoy : 0,
      // Para que el boton de jugar sepa si ya toco hoy, igual que las raciones.
      // Se compara con el dia y no se guarda un booleano: la marca sin su dia
      // no se distingue de una vieja, y al cambiar el dia se reinicia sola.
      haJugadoHoy: fila.animoDia === dia,
      regalada: fila.regalada,
      usuario: fila.userTelegramId.toString(),
    };
  }
}
