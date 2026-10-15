import { Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "../miniapp/init-data.guard.js";
import { PetsService } from "./pets.service.js";

/**
 * Las mascotas desde la Mini App.
 *
 * Todo pasa por `InitDataGuard`: la firma de Telegram es lo unico que prueba
 * quien llama. El grupo lo resuelve el servicio a partir del `start_param` y
 * comprueba ademas que quien abre esta dentro — el enlace es una peticion,
 * nunca un permiso.
 */
@Controller("v1/pets")
@UseGuards(InitDataGuard)
export class PetsController {
  // @Inject explicito: tsx/esbuild no emite metadatos de decoradores, asi que
  // la inyeccion por tipo se resolveria a undefined.
  constructor(@Inject(PetsService) private readonly pets: PetsService) {}

  /** El bicho, el saldo y el corral, en una sola llamada. */
  @Get()
  async view(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.pets.view(ctx.startParam, ctx.userId, Date.now(), {
      token: ctx.botToken,
    });
  }

  @Post("feed")
  async feed(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.pets.feed(ctx.startParam, ctx.userId, Date.now(), {
      token: ctx.botToken,
    });
  }

  /** Jugar con ella: gratis, una vez al dia. Misma guarda que `/jugar`. */
  @Post("play")
  async play(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.pets.play(ctx.startParam, ctx.userId, Date.now(), {
      token: ctx.botToken,
    });
  }

  @Post("hatch")
  async hatch(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.pets.hatch(ctx.startParam, ctx.userId, Date.now(), {
      token: ctx.botToken,
    });
  }
}
