import { Body, Controller, Post } from "@nestjs/common";
import {
  PrismaFoundationRepository,
  PrismaGuardianRepository,
} from "@superbot/data";
import { hashSessionToken } from "@superbot/module-guardian";
import { createRateLimiter } from "@superbot/shared";

/**
 * Migas de pan del NAVEGADOR: en qué pantalla iba la persona y qué reventó.
 *
 * El agujero que tapa: `progressStep` distingue "cámara concedida" (4) de "foto
 * enviada" (5), y entre esos dos números cabe toda la verificación de dos fotos
 * — hacer la primera, volver a la guía, hacer la segunda. En 30 días, 23
 * intentos se abrieron y no llegaron nunca a `attempt/submit` (el 4% de 515, en
 * los DOS grupos), y de ninguno se sabe si murió antes o después de la primera
 * foto, porque el servidor no vuelve a tener noticias hasta el envío.
 *
 * Y no había manera de averiguarlo: el seguimiento de errores es
 * deliberadamente solo de servidor (ver apps/web/instrumentation.ts), asi que un
 * fallo del navegador no deja rastro en ningún sitio. Esto no cambia esa
 * decisión —GlitchTip sigue sin exponerse— sino que manda el dato mínimo por
 * donde el cliente ya habla: la propia API.
 *
 * Se envía en el momento, NO al final: una miga que ya llegó sobrevive a que la
 * pestaña muera después, que es justo el caso que hay que cazar.
 *
 * Igual que GuardianPageViewController, deliberadamente FUERA de
 * GuardianSessionGuard: ese guard exige initData de Telegram, y una miga tiene
 * que poder salir precisamente cuando el cliente está roto. El token opaco es
 * toda la credencial, y es aceptable por lo mismo: esto solo escribe, no
 * contesta nada, no concede nada y no puede mover una sesión ni un paso.
 */
@Controller("v1/guardian")
export class GuardianClientEventController {
  private readonly guardian = new PrismaGuardianRepository();
  private readonly foundation = new PrismaFoundationRepository();

  // Una verificación normal manda un puñado de migas. Esto deja sitio de sobra
  // para eso y pone techo a quien reprodujera un token robado.
  private readonly limiter = createRateLimiter({
    capacity: 30,
    refillPerSec: 1,
  });

  @Post("client-event")
  async record(
    @Body() body: { session?: string; event?: string; detail?: string },
  ) {
    const token = body?.session;
    const event = body?.event;
    // Siempre contesta ok. Un endpoint de telemetría que dijera "esa sesión no
    // existe" dejaría probar qué tokens son buenos, y un fallo aquí no puede
    // ser visible para quien está intentando verificarse.
    if (
      !token ||
      typeof token !== "string" ||
      !event ||
      typeof event !== "string"
    ) {
      return { ok: true };
    }

    const hash = hashSessionToken(token);
    if (!this.limiter.tryConsume(hash)) {
      return { ok: true };
    }

    const session = await this.guardian
      .findSessionByTokenHash(hash)
      .catch(() => null);
    if (!session) {
      return { ok: true };
    }

    await this.foundation
      .recordAudit({
        tenantId: session.tenantId,
        actorType: "system",
        action: "guardian.client.event",
        resourceType: "verification_session",
        resourceId: session.id,
        payload: {
          event: event.slice(0, 60),
          // Recortado: un mensaje de error de navegador puede traer una traza
          // entera, y esto es una miga, no un volcado.
          ...(typeof body.detail === "string"
            ? { detail: body.detail.slice(0, 300) }
            : {}),
          telegramUserId: session.telegramUserId.toString(),
          chatId: session.chatId,
        },
      })
      .catch(() => {
        // La telemetría no vale una verificación rota.
      });

    return { ok: true };
  }
}
