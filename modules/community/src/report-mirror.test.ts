import { describe, expect, it } from "vitest";
import {
  buildReportMirrorCard,
  buildReportMirrorKeyboard,
  buildReportResolveCallback,
  buildReportResolved,
  buildReportResolvedKeyboard,
  buildTelegramMessageLink,
  defaultReportMirrorSettings,
  formatReportMirrorState,
  parseReportMirrorCommand,
  parseReportMirrorSettings,
  parseReportResolveCallback,
  type ReportMirrorEntry,
} from "./report-mirror.js";

const base: ReportMirrorEntry = {
  source: "mention",
  reporter: "@ana",
  reporterTelegramUserId: 4242n,
  text: "este tío está soltando links raros",
  chatTitle: "Grupo Tertulia",
  reported: { name: "@spammer", telegramUserId: 9000000003n },
};

const ficha = (extra: Partial<ReportMirrorEntry> = {}) =>
  buildReportMirrorCard({ ...base, ...extra });

describe("la ficha del tema de REPORTES", () => {
  it("dice quién avisa, sobre quién y qué dijo", () => {
    const texto = ficha();
    expect(texto).toContain("AVISO AL EQUIPO");
    expect(texto).toContain("@ana");
    expect(texto).toContain("@spammer");
    expect(texto).toContain("links raros");
    expect(texto).toContain("Grupo Tertulia");
  });

  it("pone el ID aparte, que es lo único que sobrevive a un cambio de alias", () => {
    expect(ficha()).toContain("<code>9000000003</code>");
  });

  it("sale igual cuando el aviso no señala a nadie", () => {
    const texto = ficha({ reported: undefined });
    expect(texto).toContain("@ana");
    expect(texto).not.toContain("Sobre:");
  });

  it("sale igual cuando el aviso va a secas, sin texto", () => {
    const texto = ficha({ text: undefined });
    expect(texto).toContain("@ana");
    expect(texto).toContain("@spammer");
  });

  it("distingue /report de @admin, porque no llegan igual", () => {
    expect(ficha({ source: "command" })).toContain("REPORTE");
    expect(ficha({ source: "command" })).not.toContain("AVISO AL EQUIPO");
  });

  it("escapa el texto de quien avisa: un < suyo no puede romper la ficha", () => {
    const texto = ficha({ text: "mira <b>esto</b> & lo otro" });
    expect(texto).toContain("&lt;b&gt;esto&lt;/b&gt; &amp; lo otro");
  });

  it("recorta un aviso larguísimo para que los botones no se vayan de pantalla", () => {
    const texto = ficha({ text: "a".repeat(2000) });
    expect(texto.length).toBeLessThan(1200);
    expect(texto).toContain("…");
  });
});

describe("el enlace al mensaje", () => {
  it("quita el -100 del id del supergrupo", () => {
    expect(
      buildTelegramMessageLink({ chatId: -1009000000006n, messageId: 55 }),
    ).toBe("https://t.me/c/9000000006/55");
  });

  it("mete el tema cuando se conoce, para poder leer lo de alrededor", () => {
    expect(
      buildTelegramMessageLink({
        chatId: -1009000000006n,
        messageId: 55,
        topicId: 7,
      }),
    ).toBe("https://t.me/c/9000000006/7/55");
  });

  it("no inventa enlace donde Telegram no lo tiene", () => {
    // Un grupo normal (sin -100) no tiene enlaces por mensaje.
    expect(buildTelegramMessageLink({ chatId: -400500n, messageId: 5 })).toBe(
      null,
    );
    expect(
      buildTelegramMessageLink({ chatId: -1009000000006n, messageId: 0 }),
    ).toBe(null);
  });
});

describe("los botones", () => {
  it("lleva al mensaje y deja darlo por resuelto", () => {
    const teclado = buildReportMirrorKeyboard({
      link: "https://t.me/c/9000000006/55",
      resolveData: "rpm:-1009000000006:55",
    }) as { inline_keyboard: Array<Array<Record<string, string>>> };
    expect(teclado.inline_keyboard[0]).toHaveLength(2);
    expect(teclado.inline_keyboard[0]?.[0]?.url).toBe(
      "https://t.me/c/9000000006/55",
    );
    expect(teclado.inline_keyboard[0]?.[1]?.callback_data).toBe(
      "rpm:-1009000000006:55",
    );
  });

  it("sin enlace posible, no pinta un botón que llevaría a un error", () => {
    const teclado = buildReportMirrorKeyboard({
      link: null,
      resolveData: "rpm:-1009000000006:0",
    }) as { inline_keyboard: Array<Array<Record<string, string>>> };
    expect(teclado.inline_keyboard[0]).toHaveLength(1);
    expect(teclado.inline_keyboard[0]?.[0]?.callback_data).toBe(
      "rpm:-1009000000006:0",
    );
  });

  it("una vez resuelta, se queda el camino de vuelta al mensaje", () => {
    const teclado = buildReportResolvedKeyboard(
      "https://t.me/c/9000000006/55",
    ) as { inline_keyboard: Array<Array<Record<string, string>>> };
    expect(teclado.inline_keyboard).toHaveLength(1);
    expect(teclado.inline_keyboard[0]?.[0]?.url).toBe(
      "https://t.me/c/9000000006/55",
    );
  });
});

describe("el ida y vuelta del botón de resuelto", () => {
  it("conserva el chat y el mensaje", () => {
    const data = buildReportResolveCallback({
      telegramChatId: -1009000000006n,
      messageId: 13523,
    });
    expect(data.length).toBeLessThanOrEqual(64);
    expect(parseReportResolveCallback(data)).toEqual({
      telegramChatId: -1009000000006n,
      messageId: 13523,
    });
  });

  it("acepta el 0: una ficha sin enlace también se puede resolver", () => {
    expect(parseReportResolveCallback("rpm:-1009000000006:0")).toEqual({
      telegramChatId: -1009000000006n,
      messageId: 0,
    });
  });

  it("deja pasar los callbacks ajenos", () => {
    expect(parseReportResolveCallback(undefined)).toBe(null);
    expect(parseReportResolveCallback("ip:k:abc")).toBe(null);
    expect(parseReportResolveCallback("rpm:no:55")).toBe(null);
    expect(parseReportResolveCallback("rpm:-100:55:extra")).toBe(null);
  });
});

describe("la ficha resuelta", () => {
  it("dice quién lo resolvió, debajo de lo que ya había", () => {
    const texto = buildReportResolved({
      card: "🚨 AVISO",
      resolvedBy: "@dani",
    });
    expect(texto).toContain("🚨 AVISO");
    expect(texto).toContain("Resuelto");
    expect(texto).toContain("@dani");
  });
});

describe("los ajustes", () => {
  it("una fila ilegible no enciende nada", () => {
    expect(parseReportMirrorSettings(null)).toEqual(
      defaultReportMirrorSettings,
    );
    expect(parseReportMirrorSettings("vale")).toEqual(
      defaultReportMirrorSettings,
    );
    expect(parseReportMirrorSettings({})).toEqual(defaultReportMirrorSettings);
  });

  it("exige un `enabled` true explícito", () => {
    expect(parseReportMirrorSettings({ enabled: "sí" }).enabled).toBe(false);
    expect(parseReportMirrorSettings({ enabled: true }).enabled).toBe(true);
  });

  it("un tema imposible vuelve a 'el de siempre', nunca a uno inventado", () => {
    expect(parseReportMirrorSettings({ staffThreadId: 0 }).staffThreadId).toBe(
      null,
    );
    expect(parseReportMirrorSettings({ staffThreadId: -7 }).staffThreadId).toBe(
      null,
    );
    expect(
      parseReportMirrorSettings({ staffThreadId: 7.5 }).staffThreadId,
    ).toBe(null);
    expect(
      parseReportMirrorSettings({ staffThreadId: "7" }).staffThreadId,
    ).toBe(null);
    expect(parseReportMirrorSettings({ staffThreadId: 7 }).staffThreadId).toBe(
      7,
    );
  });
});

describe("/reportes", () => {
  it("deja pasar los comandos ajenos", () => {
    expect(parseReportMirrorCommand("sanciones", [])).toBe(null);
    expect(parseReportMirrorCommand(undefined, [])).toBe(null);
  });

  it("sin argumentos, enseña el estado", () => {
    expect(parseReportMirrorCommand("reportes", [])).toEqual({ kind: "show" });
  });

  it("enciende, con y sin tema", () => {
    expect(parseReportMirrorCommand("reportes", ["on"])).toEqual({
      kind: "on",
      staffThreadId: null,
    });
    expect(parseReportMirrorCommand("reportes", ["on", "7"])).toEqual({
      kind: "on",
      staffThreadId: 7,
    });
  });

  it("acepta el número a secas: es lo que va a escribir cualquiera", () => {
    expect(parseReportMirrorCommand("reportes", ["7"])).toEqual({
      kind: "on",
      staffThreadId: 7,
    });
  });

  it("apaga", () => {
    expect(parseReportMirrorCommand("reportes", ["off"])).toEqual({
      kind: "off",
    });
    expect(parseReportMirrorCommand("reportes", ["apagar"])).toEqual({
      kind: "off",
    });
  });
});

describe("lo que se contesta a /reportes", () => {
  it("sin sala de staff no ofrece encenderlo, porque no publicaría nada", () => {
    const texto = formatReportMirrorState({
      settings: { enabled: true, staffThreadId: 7 },
      staffChatConfigured: false,
    });
    expect(texto).toContain("no hay a dónde");
    expect(texto).not.toContain("/reportes off");
  });

  it("encendido, dice a qué tema van", () => {
    const texto = formatReportMirrorState({
      settings: { enabled: true, staffThreadId: 7 },
      staffChatConfigured: true,
    });
    expect(texto).toContain("encendida");
    expect(texto).toContain("<code>7</code>");
  });

  it("apagado, explica cómo encenderlo", () => {
    const texto = formatReportMirrorState({
      settings: defaultReportMirrorSettings,
      staffChatConfigured: true,
    });
    expect(texto).toContain("apagada");
    expect(texto).toContain("/reportes on");
  });
});
