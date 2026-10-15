import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "../miniapp/init-data.guard.js";
import { ShopService } from "./shop.service.js";

/**
 * La tienda del grupo desde la Mini App.
 *
 * Todo pasa por `InitDataGuard`: la firma de Telegram es lo unico que prueba
 * quien llama. El grupo lo resuelve el servicio a partir del `start_param`, y
 * comprueba ademas que quien pregunta esta dentro — el enlace es una peticion,
 * nunca un permiso.
 */
@Controller("v1/shop")
@UseGuards(InitDataGuard)
export class ShopController {
  // @Inject explicito: tsx/esbuild no emite metadatos de decoradores, asi que la
  // inyeccion por tipo se resolveria a undefined.
  constructor(@Inject(ShopService) private readonly shop: ShopService) {}

  /** Escaparate, saldo, caja fuerte e inventario. */
  @Get()
  async view(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.shop.view(ctx.startParam, ctx.userId, Date.now(), {
      token: ctx.botToken,
    });
  }

  @Post("buy")
  async buy(
    @Req() req: MiniappRequest,
    @Body() body: { item?: string; texto?: string },
  ) {
    const ctx = getMiniappContext(req);
    return this.shop.buy(
      ctx.startParam,
      ctx.userId,
      String(body?.item ?? ""),
      typeof body?.texto === "string" ? body.texto : undefined,
      Date.now(),
      { token: ctx.botToken },
    );
  }

  /** Meter o sacar de la caja fuerte. Positivo guarda, negativo saca. */
  @Post("vault")
  async vault(@Req() req: MiniappRequest, @Body() body: { amount?: number }) {
    const ctx = getMiniappContext(req);
    return this.shop.vault(
      ctx.startParam,
      ctx.userId,
      Number(body?.amount ?? 0),
      Date.now(),
      { token: ctx.botToken },
    );
  }
}
