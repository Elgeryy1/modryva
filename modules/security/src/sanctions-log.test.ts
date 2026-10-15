import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  buildSanctionsLogEntry,
  defaultSanctionsLogSettings,
  formatSanctionsLogState,
  parseSanctionsLogCommand,
  parseSanctionsLogSettings,
  type SanctionsLogEntry,
} from "./sanctions-log.js";

const base: SanctionsLogEntry = {
  action: "ban",
  admin: "Dani",
  target: "@usuario_epsilon",
  targetTelegramUserId: 9000000003n,
  reason: "26 años",
  chatTitle: "La corte de los Buhos",
  caseNumber: 142,
  warnCount: undefined,
  durationMs: undefined,
  enforcementFailure: undefined,
};

const parte = (extra: Partial<SanctionsLogEntry> = {}) =>
  buildSanctionsLogEntry({ ...base, ...extra });

const update = (args: string[], name = "sanciones") =>
  ({
    command: { name, args },
  }) as unknown as TelegramUpdateEnvelope;

describe("buildSanctionsLogEntry", () => {
  it("lleva las cuatro cosas que pidieron: admin, tipo, usuario y motivo", () => {
    const texto = parte();
    expect(texto).toContain("<b>BAN</b>");
    expect(texto).toContain("<b>Admin:</b> Dani");
    expect(texto).toContain("<b>Usuario:</b> @usuario_epsilon");
    expect(texto).toContain("<b>Motivo:</b> 26 años");
  });

  it("pone el ID aparte del alias", () => {
    // Un alias se cambia en dos segundos; el ID es lo unico con lo que se puede
    // buscar a alguien meses despues.
    expect(parte()).toContain("<code>9000000003</code>");
  });

  it("no repite el ID dos renglones seguidos", () => {
    // Quien describe al usuario ya lo mete entre parentesis, y aqui va ademas en
    // su propia linea.
    const texto = parte({ target: "@usuario_epsilon (9000000003)" });
    expect(texto).toContain("<b>Usuario:</b> @usuario_epsilon\n");
    expect(texto.match(/9000000003/gu)).toHaveLength(1);
  });

  it("si el nombre es solo el ID, no lo borra", () => {
    // Alguien de quien Telegram no sabe nada se queda sin alias. Vaciar la linea
    // dejaria un "Usuario:" a secas.
    const texto = parte({ target: "9000000003" });
    expect(texto).toContain("<b>Usuario:</b> 9000000003");
  });

  it("sin motivo lo dice en vez de dejar el hueco", () => {
    expect(parte({ reason: undefined })).toContain("<b>Motivo:</b> sin motivo");
  });

  it("escapa el nombre de quien sanciona", () => {
    // El nombre lo elige quien lo lleva. Un admin llamado "<b>" no puede romper
    // el formato del parte ni inyectar marcado en el resto.
    const texto = parte({ admin: "<b>jefe</b>", target: "<i>x</i>" });
    expect(texto).toContain("&lt;b&gt;jefe&lt;/b&gt;");
    expect(texto).toContain("&lt;i&gt;x&lt;/i&gt;");
  });

  it("distingue el castigo de la marcha atras", () => {
    expect(parte({ action: "unban" })).toContain("BAN RETIRADO");
    expect(parte({ action: "kick" })).toContain("EXPULSIÓN");
    expect(parte({ action: "warn" })).toContain("AVISO");
  });

  it("un silencio siempre dice cuanto dura, indefinido incluido", () => {
    // La diferencia entre una tarde y para siempre no puede deducirse de que
    // falte una linea.
    expect(parte({ action: "mute", durationMs: undefined })).toContain(
      "<b>Duración:</b> indefinido",
    );
    expect(parte({ action: "mute", durationMs: 600_000 })).toContain(
      "<b>Duración:</b> 10 min",
    );
    expect(parte({ action: "mute", durationMs: 7_200_000 })).toContain(
      "<b>Duración:</b> 2 h",
    );
    expect(parte({ action: "mute", durationMs: 604_800_000 })).toContain(
      "<b>Duración:</b> 7 d",
    );
  });

  it("un ban no lleva linea de duracion", () => {
    expect(parte()).not.toContain("Duración");
  });

  it("los avisos llevan el contador", () => {
    expect(parte({ action: "warn", warnCount: "2/3" })).toContain(
      "<b>Avisos:</b> 2/3",
    );
  });

  it("si Telegram lo rechazo, el parte lo dice bien claro", () => {
    // Es el motivo de que este registro valga algo. Un parte que anuncia "BAN"
    // de un baneo rechazado da el caso por resuelto, y el equipo solo se entera
    // cuando la persona vuelve a escribir.
    const texto = parte({ enforcementFailure: "not enough rights" });
    expect(texto).toContain("Telegram lo rechazó");
    expect(texto).toContain("not enough rights");
    expect(texto).toContain("la acción NO se aplicó");
  });

  it("cuando salio bien no insinua ningun fallo", () => {
    expect(parte()).not.toContain("rechazó");
  });
});

describe("parseSanctionsLogSettings", () => {
  it("apagado por defecto: una fila ilegible no empieza a publicar nombres", () => {
    for (const basura of [null, undefined, 7, "on", [], {}]) {
      expect(parseSanctionsLogSettings(basura)).toEqual(
        defaultSanctionsLogSettings,
      );
    }
  });

  it("exige un true explicito", () => {
    expect(parseSanctionsLogSettings({ enabled: "true" }).enabled).toBe(false);
    expect(parseSanctionsLogSettings({ enabled: 1 }).enabled).toBe(false);
    expect(parseSanctionsLogSettings({ enabled: true }).enabled).toBe(true);
  });

  it("un tema imposible vuelve a null, no a un tema inventado", () => {
    for (const basura of [0, -3, 1.5, "187", null, Number.NaN, {}]) {
      expect(
        parseSanctionsLogSettings({ enabled: true, staffThreadId: basura })
          .staffThreadId,
      ).toBeNull();
    }
    expect(
      parseSanctionsLogSettings({ enabled: true, staffThreadId: 187 })
        .staffThreadId,
    ).toBe(187);
  });

  it("sobrevive a releerse a si mismo", () => {
    const guardado = parseSanctionsLogSettings({
      enabled: true,
      staffThreadId: 187,
    });
    expect(parseSanctionsLogSettings(guardado)).toEqual(guardado);
  });
});

describe("parseSanctionsLogCommand", () => {
  it("deja pasar lo que no es suyo", () => {
    expect(parseSanctionsLogCommand(update([], "ban"))).toBeNull();
    expect(
      parseSanctionsLogCommand({} as unknown as TelegramUpdateEnvelope),
    ).toBeNull();
  });

  it("a secas enseña el estado", () => {
    expect(parseSanctionsLogCommand(update([]))).toEqual({ kind: "show" });
  });

  it("enciende con y sin tema", () => {
    expect(parseSanctionsLogCommand(update(["on"]))).toEqual({
      kind: "on",
      staffThreadId: null,
    });
    expect(parseSanctionsLogCommand(update(["on", "187"]))).toEqual({
      kind: "on",
      staffThreadId: 187,
    });
  });

  it("acepta el numero a pelo, que es lo que va a escribir cualquiera", () => {
    // Acaba de copiar el numero del tema de /topicid. Negarselo por una palabra
    // seria un no gratuito.
    expect(parseSanctionsLogCommand(update(["187"]))).toEqual({
      kind: "on",
      staffThreadId: 187,
    });
  });

  it("apaga", () => {
    for (const palabra of ["off", "OFF", "no", "apagar"]) {
      expect(parseSanctionsLogCommand(update([palabra]))).toEqual({
        kind: "off",
      });
    }
  });

  it("ante algo que no entiende, enseña el estado en vez de romper", () => {
    expect(parseSanctionsLogCommand(update(["patata"]))).toEqual({
      kind: "show",
    });
    expect(parseSanctionsLogCommand(update(["on", "-5"]))).toEqual({
      kind: "on",
      staffThreadId: null,
    });
  });
});

describe("formatSanctionsLogState", () => {
  it("sin sala de STAFF avisa de que no hay a donde mandarlo", () => {
    // Encenderlo sin sala dejaria un interruptor en "on" que no publica nada:
    // la forma mas fiable de creer que hay registro cuando no lo hay.
    const texto = formatSanctionsLogState({
      settings: { enabled: true, staffThreadId: 187 },
      staffChatConfigured: false,
    });
    expect(texto).toContain("no tiene sala de STAFF");
    expect(texto).not.toContain("encendido");
  });

  it("apagado enseña como encenderlo", () => {
    const texto = formatSanctionsLogState({
      settings: defaultSanctionsLogSettings,
      staffChatConfigured: true,
    });
    expect(texto).toContain("apagado");
    expect(texto).toContain("/sanciones on");
  });

  it("encendido dice exactamente a donde va", () => {
    expect(
      formatSanctionsLogState({
        settings: { enabled: true, staffThreadId: 187 },
        staffChatConfigured: true,
      }),
    ).toContain("<code>187</code>");
    expect(
      formatSanctionsLogState({
        settings: { enabled: true, staffThreadId: null },
        staffChatConfigured: true,
      }),
    ).toContain("el tema de siempre");
  });
});
