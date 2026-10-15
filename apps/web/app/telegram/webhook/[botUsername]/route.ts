import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const botBaseUrl = (): string =>
  process.env.BOT_INTERNAL_URL ?? "http://bot:3002";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ botUsername: string }> },
): Promise<NextResponse> {
  const { botUsername } = await ctx.params;
  if (!/^[A-Za-z0-9_]{1,64}$/u.test(botUsername)) {
    return NextResponse.json(
      { error: "invalid-bot-username" },
      { status: 400 },
    );
  }

  const target = new URL(
    `/telegram/webhook/${botUsername}`,
    botBaseUrl().endsWith("/") ? botBaseUrl() : `${botBaseUrl()}/`,
  );
  const headers = new Headers();
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret) {
    headers.set("x-telegram-bot-api-secret-token", secret);
  }
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  try {
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      headers,
      body: req.body,
      duplex: "half",
      redirect: "manual",
    };
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers();
    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) {
      responseHeaders.set("content-type", upstreamContentType);
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "bot-upstream-unreachable" },
      { status: 502 },
    );
  }
}
