import type { FoundationContext } from "@superbot/data";
import type { BotReply, TelegramUpdateEnvelope } from "@superbot/domain";
import type { MiniAppLink } from "./core-handlers.js";

export interface BotHandlerInput {
  readonly context: FoundationContext;
  readonly update: TelegramUpdateEnvelope;
  readonly rawUpdate: unknown;
  readonly botUsername: string;
  readonly replyBotUsername: string;
  readonly miniAppLink: MiniAppLink;
}

export interface BotUpdateHandler {
  readonly name: string;
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
  readonly name: string;
  readonly run: (input: BotPostProcessorInput) => Promise<void>;
}
