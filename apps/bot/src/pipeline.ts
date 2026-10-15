import type { FoundationContext } from "@superbot/data";
import type { BotReply, TelegramUpdateEnvelope } from "@superbot/domain";
import type { MiniAppLink } from "./core-handlers.js";
import type {
  NombreDeHandler,
  NombreDePostProcesador,
} from "./handler-names.js";

export interface BotHandlerInput {
  readonly context: FoundationContext;
  readonly update: TelegramUpdateEnvelope;
  readonly rawUpdate: unknown;
  readonly botUsername: string;
  readonly replyBotUsername: string;
  readonly miniAppLink: MiniAppLink;
}

export interface BotUpdateHandler {
  /**
   * Nombre estable del handler. Es tipado a proposito: forma parte del orden,
   * de los gates, de las metricas y del debugging, asi que renombrarlo es un
   * cambio de comportamiento observable y debe pasar por `handler-names.ts`.
   */
  readonly name: NombreDeHandler;
  readonly handle: (
    input: BotHandlerInput,
  ) => BotReply | null | Promise<BotReply | null>;
}

export type BotGuardDecision =
  | {
      readonly blocked: false;
    }
  | {
      readonly blocked: true;
      readonly handled: boolean;
      readonly reply: BotReply | null;
      readonly callbackText?: string;
    };

export interface BotPostProcessorInput extends BotHandlerInput {
  readonly commandReply: BotReply | null;
}

export interface BotPostProcessor {
  readonly name: NombreDePostProcesador;
  readonly run: (input: BotPostProcessorInput) => Promise<void>;
}
