import { z } from "zod";

const commandPattern = /^\/([a-z0-9_]+)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i;

const commandParseSchema = z.object({
  command: z.string().min(1),
  botUsername: z.string().optional(),
  payload: z.string().optional(),
});

export interface ParsedCommand {
  readonly name: string;
  readonly botUsername?: string;
  readonly args: readonly string[];
  readonly raw: string;
  readonly alias?: string;
}

export const parseTelegramCommand = (
  text: string,
  botUsername?: string,
): ParsedCommand | null => {
  const match = commandPattern.exec(text.trim());

  if (!match) {
    return null;
  }

  const parsed = commandParseSchema.parse({
    command: match[1]?.toLowerCase() ?? "",
    botUsername: match[2]?.toLowerCase(),
    payload: match[3]?.trim(),
  });

  if (
    parsed.botUsername &&
    botUsername &&
    parsed.botUsername !== botUsername.toLowerCase()
  ) {
    return null;
  }

  return {
    name: parsed.command,
    args: parsed.payload ? parsed.payload.split(/\s+/u).filter(Boolean) : [],
    raw: text,
    ...(parsed.botUsername ? { botUsername: parsed.botUsername } : {}),
  };
};
