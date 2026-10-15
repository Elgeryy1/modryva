import { describe, expect, it } from "vitest";
import {
  buildIntroductionAccepted,
  buildIntroductionForgiven,
  buildIntroductionKickNotice,
  buildIntroductionMirrorCard,
  buildIntroductionMirrorKeyboard,
  buildIntroductionPrompt,
  buildIntroductionStaffAutoResolved,
  buildIntroductionStaffCallback,
  buildIntroductionStaffCard,
  buildIntroductionStaffKeyboard,
  buildIntroductionStaffResolved,
  buildIntroductionWarnNotice,
  buildRepresentNotice,
  checkIntroduction,
  defaultIntroductionSettings,
  escapeHtml,
  formatElapsed,
  formatIntroductionMirrorState,
  mentionHtml,
  parseIntroductionAdminCommand,
  parseIntroductionMirrorCommand,
  parseIntroductionSettings,
  parseIntroductionStaffCallback,
} from "./introduction.js";

const settings = { ...defaultIntroductionSettings, enabled: true };
const NOW_YEAR = 2026;

const check = (text: string, hasPhoto = true) =>
  checkIntroduction({ text, hasPhoto, settings, nowYear: NOW_YEAR });

describe("checkIntroduction — accepts a real introduction", () => {
  it("accepts the ordinary shape", () => {
    expect(check("Hola, tengo 18 años y soy de Madrid").complete).toBe(true);
  });

  it("accepts a birth year instead of an age", () => {
    const result = check("Hola! 2006, de Sevilla");
    expect(result.complete).toBe(true);
    expect(result.age).toBe(20);
  });

  it("accepts the terse version people actually write", () => {
    // "18 Madrid" with a photo is how half of them answer. Rejecting it would
    // remove someone who did exactly what was asked.
    expect(check("18 Madrid").complete).toBe(true);
  });

  it("accepts a bare place name with no preposition", () => {
    expect(check("tengo 20 Barcelona").complete).toBe(true);
  });
});

describe("checkIntroduction — what is genuinely missing", () => {
  it("flags a missing photo", () => {
    expect(check("18, de Madrid", false).missing).toContain("photo");
  });

  it("flags a missing age", () => {
    const result = check("hola soy de Madrid");
    expect(result.missing).toContain("age");
    expect(result.age).toBeNull();
  });

  it("flags a missing origin", () => {
    expect(check("tengo 18 años").missing).toContain("origin");
  });

  it("reports a photo with no caption as incomplete, not complete", () => {
    const result = check("");
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(["age", "origin"]);
  });
});

describe("checkIntroduction — numbers that are NOT an age", () => {
  // Reading a random number as an age would let someone through who never
  // said it — the harmless direction — but reading a real age as garbage
  // removes a person, so the bounds matter in both directions.
  it("ignores a number far outside a human age", () => {
    expect(check("mi codigo es 1234").age).toBeNull();
  });

  it("ignores a year that would imply an absurd age", () => {
    expect(check("desde 1850 en Madrid").age).not.toBe(176);
  });

  it("prefers a birth year over a stray small number", () => {
    // "sala 3" should not win over "2005".
    expect(check("sala 3, nací en 2005, de Vigo").age).toBe(21);
  });
});

describe("checkIntroduction — respects what the group asks for", () => {
  it("skips the photo when the group does not require one", () => {
    const noPhoto = { ...settings, requirePhoto: false };
    const result = checkIntroduction({
      text: "18, de Madrid",
      hasPhoto: false,
      settings: noPhoto,
      nowYear: NOW_YEAR,
    });
    expect(result.complete).toBe(true);
  });

  it("accepts anything when nothing is required", () => {
    const nothing = {
      ...settings,
      requirePhoto: false,
      requireAge: false,
      requireOrigin: false,
    };
    expect(
      checkIntroduction({
        text: "hola",
        hasPhoto: false,
        settings: nothing,
        nowYear: NOW_YEAR,
      }).complete,
    ).toBe(true);
  });
});

describe("messages", () => {
  it("says exactly what to send and what happens if they don't", () => {
    const prompt = buildIntroductionPrompt("@ana", settings);
    expect(prompt).toContain("foto o vídeo");
    expect(prompt).toContain("año de nacimiento");
    expect(prompt).toContain("dónde eres");
    expect(prompt).toContain("12 horas");
    // La consecuencia se dice, y desde la escalada (2026-08-13) la de verdad
    // ES salir del grupo — con la vuelta atrás en el mismo mensaje, porque
    // quien lo lee como un baneo no vuelve.
    expect(prompt).toContain("sales del grupo");
    expect(prompt).toContain("volver a entrar");
  });

  it("sin expulsión automática NO amenaza con una que no llega", () => {
    // La regla de siempre en el otro sentido: prometer una expulsión que el
    // bot no ejecuta quema el aviso a la primera comprobación.
    const prompt = buildIntroductionPrompt("@ana", {
      ...settings,
      autoKickAtLimit: false,
    });
    expect(prompt).toContain("lo revisa un admin");
    expect(prompt).not.toContain("sales del grupo");
  });

  it("sin escalada el mensaje es el de antes de que existiera", () => {
    const prompt = buildIntroductionPrompt("@ana", {
      ...settings,
      reminderEveryHours: null,
    });
    expect(prompt).toContain("lo revisa un admin");
    expect(prompt).not.toContain("sales del grupo");
  });
});

describe("mensajes con formato", () => {
  it("el aviso de entrada lleva el bloque de instrucciones y el plazo", () => {
    const t = buildIntroductionPrompt(
      '<a href="tg://user?id=1">Ana</a>',
      settings,
    );
    expect(t).toContain("preséntate para quedarte");
    expect(t).toContain("<blockquote>");
    expect(t).toContain("<b>foto o vídeo</b>");
    expect(t).toContain("<b>12 horas</b>");
    // La consecuencia se dice tal como es con los ajustes por defecto: la
    // escalada avisa y al límite se sale del grupo.
    expect(t).toContain("sales del grupo");
  });

  it("pide SOLO lo que el grupo exige de verdad", () => {
    const soloEdad = buildIntroductionPrompt("Ana", {
      ...settings,
      requirePhoto: false,
      requireOrigin: false,
    });
    // Prometer una foto donde el grupo no la pide acaba echando a quien hizo caso.
    expect(soloEdad).not.toContain("foto o vídeo");
    expect(soloEdad).not.toContain("dónde eres");
    expect(soloEdad).toContain("año de nacimiento");
  });

  it("/nopresentado dice quién es y por qué reaparece el aviso", () => {
    const t = buildRepresentNotice(
      '<a href="tg://user?id=1">David</a>',
      settings,
    );
    expect(t).toContain("tienes que volver a presentarte");
    expect(t).toContain("<blockquote>");
    expect(t).toContain("<b>12 horas</b>");
  });

  it("singulariza el plazo de una hora", () => {
    expect(
      buildRepresentNotice("Ana", { ...settings, deadlineHours: 1 }),
    ).toContain("<b>1 hora</b>");
  });

  it("las confirmaciones nombran a la persona", () => {
    expect(buildIntroductionAccepted("@ana")).toContain("Listo, @ana");
    expect(buildIntroductionForgiven("@ana")).toContain("@ana");
  });
});

describe("escapeHtml / mentionHtml", () => {
  it("un nombre con etiquetas no puede romper el formato", () => {
    expect(escapeHtml("<b>hola</b> & adios")).toBe(
      "&lt;b&gt;hola&lt;/b&gt; &amp; adios",
    );
  });

  it("la mención funciona aunque no tenga alias", () => {
    expect(mentionHtml(123n, "Ana")).toBe('<a href="tg://user?id=123">Ana</a>');
  });

  it("escapa el nombre dentro de la mención", () => {
    expect(mentionHtml(123n, "<script>")).toContain("&lt;script&gt;");
  });
});

describe("parseIntroductionAdminCommand", () => {
  it("reconoce los dos comandos", () => {
    expect(parseIntroductionAdminCommand("presentado")).toEqual({
      kind: "presented",
    });
    expect(parseIntroductionAdminCommand("nopresentado")).toEqual({
      kind: "not-presented",
    });
    expect(parseIntroductionAdminCommand("no_presentado")).toEqual({
      kind: "not-presented",
    });
  });

  it.each([undefined, "", "ban", "presentacion"])("ignora %s", (name) => {
    expect(parseIntroductionAdminCommand(name)).toBeNull();
  });
});

describe("ficha de STAFF — ida y vuelta del callback", () => {
  it("lo que se construye es lo que se lee", () => {
    for (const action of ["kick", "keep"] as const) {
      const data = buildIntroductionStaffCallback(action, "cmsc1l769003ymo0z");
      expect(parseIntroductionStaffCallback(data)).toEqual({
        action,
        pendingId: "cmsc1l769003ymo0z",
      });
    }
  });

  it("cabe en los 64 bytes que admite Telegram con un cuid entero", () => {
    const data = buildIntroductionStaffCallback(
      "kick",
      "cmscawt6r03n5lc0zr0489smo",
    );
    expect(Buffer.byteLength(data, "utf8")).toBeLessThanOrEqual(64);
  });

  it.each([
    undefined,
    "",
    "cg:j:abc",
    "ip:x:abc",
    "ip:k",
    "ip:k:",
    "ip:k:abc:extra",
  ])("deja pasar lo ajeno o roto: %s", (data) => {
    expect(parseIntroductionStaffCallback(data)).toBeNull();
  });
});

describe("ficha de STAFF — el texto", () => {
  const card = () =>
    buildIntroductionStaffCard({
      pendingId: "p1",
      telegramUserId: 9000000003n,
      username: "marcosss_r",
      displayName: null,
      joinedAt: new Date("2026-08-02T17:29:40Z"),
      dueAt: new Date("2026-08-03T05:29:40Z"),
      now: new Date("2026-08-03T05:32:40Z"),
      chatTitle: "Grupo Central",
      timeZone: "Europe/Madrid",
    });

  it("lleva el ID numérico, no solo el alias", () => {
    // Un @alias se cambia en dos segundos; el ID es lo único con lo que se
    // puede buscar a alguien después de haberlo expulsado.
    expect(card()).toContain("9000000003");
  });

  it("dice cuándo entró y cuánto hace que se le pasó el plazo", () => {
    const t = card();
    expect(t).toContain("19:29"); // 17:29 UTC en horario de Madrid
    expect(t).toContain("3 min");
  });

  it("escapa el nombre del grupo y el alias", () => {
    const t = buildIntroductionStaffCard({
      pendingId: "p1",
      telegramUserId: 1n,
      username: "a<b>b",
      displayName: null,
      joinedAt: new Date("2026-08-02T17:00:00Z"),
      dueAt: new Date("2026-08-03T05:00:00Z"),
      now: new Date("2026-08-03T05:00:00Z"),
      chatTitle: "<script>x</script>",
      timeZone: "Europe/Madrid",
    });
    expect(t).not.toContain("<script>");
    expect(t).toContain("&lt;script&gt;");
    expect(t).toContain("a&lt;b&gt;b");
  });

  it("el teclado lleva los dos botones apuntando a la misma fila", () => {
    const keyboard = buildIntroductionStaffKeyboard("p1") as {
      inline_keyboard: { text: string; callback_data: string }[][];
    };
    const botones = keyboard.inline_keyboard[0] ?? [];
    expect(botones).toHaveLength(2);
    for (const boton of botones) {
      expect(
        parseIntroductionStaffCallback(boton.callback_data)?.pendingId,
      ).toBe("p1");
    }
  });
});

describe("ficha de STAFF — el veredicto", () => {
  it("nunca dice 'expulsado' si Telegram no lo aceptó", () => {
    const t = buildIntroductionStaffResolved({
      card: "ficha",
      action: "kick",
      decidedBy: "@ana",
      telegramOk: false,
    });
    expect(t).not.toContain("Expulsado");
    expect(t).toContain("a mano");
  });

  it("nombra a quien lo decidió en los dos casos", () => {
    for (const action of ["kick", "keep"] as const) {
      const t = buildIntroductionStaffResolved({
        card: "ficha",
        action,
        decidedBy: "@ana",
        telegramOk: true,
      });
      expect(t).toContain("@ana");
      expect(t).toContain("ficha");
    }
  });
});

describe("formatElapsed", () => {
  it.each([
    [0, "menos de 1 min"],
    [59_000, "menos de 1 min"],
    [60_000, "1 min"],
    [3_600_000, "1 h"],
    [3_660_000, "1 h y 1 min"],
    [-5_000, "menos de 1 min"],
  ])("%s ms → %s", (ms, esperado) => {
    expect(formatElapsed(ms)).toBe(esperado);
  });
});

/**
 * El tema propio para las fichas de presentacion.
 *
 * Lo que se fija aqui no es que el numero se guarde, sino las dos formas en que
 * este ajuste podria hacer daño en silencio: que un valor absurdo mande las
 * fichas a un tema inventado (donde nadie las mira), y que guardar desde la
 * Mini App lo borre sin que nadie se entere — porque ese guardado pasa por
 * `parseIntroductionSettings` y lo que el parser no conoce, no sobrevive.
 */
describe("tema propio de las presentaciones", () => {
  it("por defecto es null: van donde han ido siempre", () => {
    expect(defaultIntroductionSettings.staffThreadId).toBeNull();
    expect(parseIntroductionSettings({}).staffThreadId).toBeNull();
  });

  it("guarda un tema valido", () => {
    expect(
      parseIntroductionSettings({ staffThreadId: 963 }).staffThreadId,
    ).toBe(963);
  });

  it("un valor imposible vuelve a null, no a un tema inventado", () => {
    // Mandar las fichas a un tema que no existe es peor que mandarlas al de
    // siempre: Telegram las rechaza o aterrizan donde nadie mira.
    for (const basura of [0, -3, 1.5, "963", null, Number.NaN, {}]) {
      expect(
        parseIntroductionSettings({ staffThreadId: basura }).staffThreadId,
      ).toBeNull();
    }
  });

  it("sobrevive a un guardado desde la Mini App", () => {
    // La Mini App hace parse(body) y guarda el resultado. Si el parser no
    // conociera el campo, cualquier cambio de otra opcion lo borraria y las
    // fichas volverian al tema de Guardian sin que nadie tocara nada.
    const guardado = parseIntroductionSettings({
      enabled: true,
      deadlineHours: 24,
      staffThreadId: 963,
    });
    const reguardado = parseIntroductionSettings({
      ...guardado,
      requirePhoto: false,
    });

    expect(reguardado.staffThreadId).toBe(963);
    expect(reguardado.enabled).toBe(true);
  });
});

describe("buildIntroductionWarnNotice", () => {
  const aviso = (
    warn: { count: number; limit: number },
    extra: Partial<typeof settings> = {},
  ) =>
    buildIntroductionWarnNotice({
      who: "Marcos",
      settings: { ...settings, ...extra },
      warn,
    });

  it("dice el porque, no solo el contador", () => {
    // Un "aviso 1/3" a secas obliga a preguntar que has hecho, y quien no
    // pregunta se va.
    const texto = aviso({ count: 1, limit: 3 });
    expect(texto).toContain("aviso automático 1/3");
    expect(texto).toContain("plazo ha vencido");
    expect(texto).toContain("<b>12 horas</b>");
  });

  it("repite solo los requisitos que el grupo pide de verdad", () => {
    // Pedir una foto donde el grupo no la pide es avisar a alguien por no
    // hacer algo que nadie le pidio.
    const texto = aviso({ count: 1, limit: 3 }, { requirePhoto: false });
    expect(texto).not.toContain("foto");
    expect(texto).toContain("año de nacimiento");
  });

  it("sin expulsion automatica, al limite avisa de que NO se ha sancionado", () => {
    const texto = aviso({ count: 3, limit: 3 }, { autoKickAtLimit: false });
    expect(texto).toContain("límite de avisos");
    expect(texto).toContain("<b>No te he sancionado</b>");
    expect(texto).toContain("lo mira un admin");
  });

  it("sin expulsion automatica ofrece la salida en vez de amenazar", () => {
    expect(aviso({ count: 1, limit: 3 }, { autoKickAtLimit: false })).toContain(
      "un admin te quita el aviso",
    );
  });

  // Con la expulsion automatica (el default), cada texto dice la consecuencia
  // REAL de ese punto del embudo. Mentir en cualquiera de los tres quema el
  // aviso: o amenaza con algo que no llega, o calla algo que si.
  it("con expulsion automatica anuncia el limite desde el primer aviso", () => {
    const texto = aviso({ count: 1, limit: 3 });
    expect(texto).toContain("Al llegar a 3/3 sales del grupo");
    expect(texto).toContain("volver a entrar");
    expect(texto).not.toContain("No te he sancionado");
  });

  it("el penultimo aviso lo dice sin rodeos", () => {
    expect(aviso({ count: 2, limit: 3 })).toContain(
      "Al siguiente aviso sales del grupo",
    );
  });

  it("en el limite dice que la salida es inminente y aun evitable", () => {
    const texto = aviso({ count: 3, limit: 3 });
    expect(texto).toContain("sales del grupo");
    expect(texto).toContain("salvo que te presentes");
    expect(texto).not.toContain("No te he sancionado");
  });
});

describe("buildIntroductionKickNotice", () => {
  it("dice quien, cuantos avisos, y que puede volver", () => {
    const texto = buildIntroductionKickNotice({
      who: "Marcos",
      warn: { count: 3, limit: 3 },
    });
    expect(texto).toContain("Marcos");
    expect(texto).toContain("3/3");
    expect(texto).toContain("sale del grupo");
    // El kick es de 120 s: quien lo lee como baneo no vuelve a intentarlo.
    expect(texto).toContain("volver a entrar");
  });
});

describe("buildIntroductionStaffAutoResolved", () => {
  it("deja escrito que fue el bot y por que", () => {
    const texto = buildIntroductionStaffAutoResolved({
      card: "FICHA",
      warn: { count: 3, limit: 3 },
    });
    expect(texto).toContain("FICHA");
    expect(texto).toContain("Expulsado automáticamente");
    expect(texto).toContain("3/3");
    expect(texto).toContain("Puede volver a entrar");
  });
});

describe("la escalada en los ajustes", () => {
  it("por defecto: cada 2 horas y con expulsion al limite", () => {
    const ajustes = parseIntroductionSettings({});
    expect(ajustes.reminderEveryHours).toBe(2);
    expect(ajustes.autoKickAtLimit).toBe(true);
  });

  it("null guardado significa apagada y sobrevive al reguardado", () => {
    // La distincion null/ausente es lo unico que permite APAGARLA: si null
    // cayera al default, apagar y no decir nada serian lo mismo.
    const guardado = parseIntroductionSettings({ reminderEveryHours: null });
    expect(guardado.reminderEveryHours).toBeNull();
    expect(
      parseIntroductionSettings({ ...guardado }).reminderEveryHours,
    ).toBeNull();
  });

  it("una cadencia absurda cae al default, no a un numero absurdo", () => {
    for (const basura of [0, -2, 1.5, "2", 49, Number.NaN, {}]) {
      expect(
        parseIntroductionSettings({ reminderEveryHours: basura })
          .reminderEveryHours,
      ).toBe(2);
    }
  });

  it("autoKickAtLimit false sobrevive a un guardado desde la Mini App", () => {
    const guardado = parseIntroductionSettings({ autoKickAtLimit: false });
    expect(guardado.autoKickAtLimit).toBe(false);
    expect(
      parseIntroductionSettings({ ...guardado, requirePhoto: false })
        .autoKickAtLimit,
    ).toBe(false);
  });
});

describe("la ficha de STAFF con aviso", () => {
  const ficha = (warn?: { count: number; limit: number }) =>
    buildIntroductionStaffCard({
      pendingId: "p1",
      telegramUserId: 9000000003n,
      username: "marcosss_r",
      displayName: null,
      joinedAt: new Date("2026-08-02T17:00:00Z"),
      dueAt: new Date("2026-08-03T05:00:00Z"),
      now: new Date("2026-08-03T05:30:00Z"),
      chatTitle: "Grupo Central",
      ...(warn ? { warn } : {}),
    });

  it("sin warn no menciona ninguno", () => {
    // Anunciar un aviso que no existe manda al staff a buscarlo al historial.
    expect(ficha()).not.toContain("Aviso automático");
  });

  it("con warn da el numero exacto", () => {
    expect(ficha({ count: 2, limit: 3 })).toContain("Aviso automático 2/3");
  });

  it("marca el limite alcanzado y aclara que no se sanciono", () => {
    const texto = ficha({ count: 3, limit: 3 });
    expect(texto).toContain("límite alcanzado");
    expect(texto).toContain("No he sancionado a nadie");
  });

  it("con la escalada dice lo que pasara si nadie decide", () => {
    // Sin esta linea el staff cree que la ficha espera para siempre — que fue
    // verdad hasta agosto de 2026 y dejo de serlo.
    const conKick = buildIntroductionStaffCard({
      pendingId: "p1",
      telegramUserId: 9000000003n,
      username: "marcosss_r",
      displayName: null,
      joinedAt: new Date("2026-08-02T17:00:00Z"),
      dueAt: new Date("2026-08-03T05:00:00Z"),
      now: new Date("2026-08-03T05:30:00Z"),
      chatTitle: "Grupo Central",
      escalation: { everyHours: 2, autoKick: true },
    });
    expect(conKick).toContain("sigo avisando cada 2 h");
    expect(conKick).toContain("lo expulso yo");

    const sinKick = buildIntroductionStaffCard({
      pendingId: "p1",
      telegramUserId: 9000000003n,
      username: "marcosss_r",
      displayName: null,
      joinedAt: new Date("2026-08-02T17:00:00Z"),
      dueAt: new Date("2026-08-03T05:00:00Z"),
      now: new Date("2026-08-03T05:30:00Z"),
      chatTitle: "Grupo Central",
      escalation: { everyHours: 2, autoKick: false },
    });
    expect(sinKick).toContain("expulsar sigue siendo cosa vuestra");
    // Y sin escalada, ni una palabra de ella.
    expect(ficha()).not.toContain("Si nadie decide");
  });
});

describe("el espejo de presentaciones", () => {
  const ficha = (extra: Record<string, unknown> = {}) =>
    buildIntroductionMirrorCard({
      telegramUserId: 9000000003n,
      displayName: "Ana",
      username: "ana_00",
      age: 18,
      chatTitle: "Grupo Tertulia",
      copied: true,
      ...extra,
    });

  it("dice quién es, con su alias y su ID", () => {
    const texto = ficha();
    expect(texto).toContain("Se ha presentado");
    expect(texto).toContain("Ana");
    expect(texto).toContain("@ana_00");
    expect(texto).toContain("<code>9000000003</code>");
    expect(texto).toContain("Grupo Tertulia");
  });

  it("apunta la edad que leyó, que es medio motivo de mirar la ficha", () => {
    expect(ficha()).toContain("18");
    expect(ficha({ age: null })).not.toContain("Dice tener");
  });

  it("sale igual sin alias: no todo el mundo tiene", () => {
    expect(ficha({ username: null })).not.toContain("(@");
  });

  it("avisa cuando la copia del mensaje no llegó", () => {
    // Una ficha suelta sin la foto encima se lee como que no mandó nada, que es
    // justo lo contrario de lo que pasó.
    expect(ficha({ copied: false })).toContain("No he podido copiar");
    expect(ficha()).not.toContain("No he podido copiar");
  });

  it("escapa el nombre: alguien llamado <b> no rompe la ficha", () => {
    expect(ficha({ displayName: "<b>Ana</b>" })).toContain("&lt;b&gt;Ana");
  });

  it("sin enlace posible no pinta un botón que llevaría a un error", () => {
    expect(buildIntroductionMirrorKeyboard(null)).toEqual({
      inline_keyboard: [],
    });
    const teclado = buildIntroductionMirrorKeyboard(
      "https://t.me/c/9000000006/55",
    ) as { inline_keyboard: Array<Array<Record<string, string>>> };
    expect(teclado.inline_keyboard[0]?.[0]?.url).toBe(
      "https://t.me/c/9000000006/55",
    );
  });
});

describe("/presentaciones", () => {
  it("deja pasar los comandos ajenos", () => {
    expect(parseIntroductionMirrorCommand("presentado", [])).toBe(null);
    expect(parseIntroductionMirrorCommand(undefined, [])).toBe(null);
  });

  it("enciende, con y sin tema, y apaga", () => {
    expect(parseIntroductionMirrorCommand("presentaciones", ["on"])).toEqual({
      kind: "on",
      staffThreadId: null,
    });
    expect(
      parseIntroductionMirrorCommand("presentaciones", ["on", "13523"]),
    ).toEqual({ kind: "on", staffThreadId: 13523 });
    expect(parseIntroductionMirrorCommand("presentaciones", ["13523"])).toEqual(
      {
        kind: "on",
        staffThreadId: 13523,
      },
    );
    expect(parseIntroductionMirrorCommand("presentaciones", ["off"])).toEqual({
      kind: "off",
    });
  });

  it("sin argumentos, enseña el estado", () => {
    expect(parseIntroductionMirrorCommand("presentaciones", [])).toEqual({
      kind: "show",
    });
  });
});

describe("lo que se contesta a /presentaciones", () => {
  it("sin sala de staff no ofrece encenderlo, porque no copiaría nada", () => {
    expect(
      formatIntroductionMirrorState({
        settings: { ...settings, mirrorToStaff: true },
        staffChatConfigured: false,
      }),
    ).toContain("no hay a dónde");
  });

  it("encendido, dice a qué tema van", () => {
    const texto = formatIntroductionMirrorState({
      settings: { ...settings, mirrorToStaff: true, staffThreadId: 13523 },
      staffChatConfigured: true,
    });
    expect(texto).toContain("encendida");
    expect(texto).toContain("<code>13523</code>");
  });

  it("apagado, recuerda que las fichas de 'no presentado' siguen yendo", () => {
    const texto = formatIntroductionMirrorState({
      settings: { ...settings, mirrorToStaff: false, staffThreadId: 13523 },
      staffChatConfigured: true,
    });
    expect(texto).toContain("apagada");
    expect(texto).toContain("sí siguen yendo");
  });

  it("avisa si la puerta está apagada: encendido así no copia nada", () => {
    const texto = formatIntroductionMirrorState({
      settings: { ...settings, enabled: false, mirrorToStaff: true },
      staffChatConfigured: true,
    });
    expect(texto).toContain("apagada</b> en este grupo");
  });
});
