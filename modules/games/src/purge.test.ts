import { describe, expect, it } from "vitest";
import {
  decidePurge,
  defaultPurgeSettings,
  isPurgeOpen,
  maxPurgeDurationMinutes,
  type PurgePlay,
  type PurgeSettings,
  parsePurgeSettings,
  parsePurgeState,
  renderPurgeBoard,
  scheduleNextPurge,
} from "./purge.js";

const DIA = 24 * 60 * 60 * 1000;
const HORA = 60 * 60 * 1000;
/** Un 1 de enero a las 00:00 UTC exactas, para que las cuentas se lean solas. */
const MEDIANOCHE = Math.floor(1_700_000_000_000 / DIA) * DIA;

const ajustes = (over: Partial<PurgeSettings> = {}): PurgeSettings => ({
  ...defaultPurgeSettings,
  enabled: true,
  ...over,
});

describe("parsePurgeSettings", () => {
  it("cae a los valores por defecto con basura", () => {
    expect(parsePurgeSettings(null)).toEqual(defaultPurgeSettings);
    expect(parsePurgeSettings("no")).toEqual(defaultPurgeSettings);
  });

  it("nace apagada", () => {
    expect(parsePurgeSettings({}).enabled).toBe(false);
  });

  it("rechaza entera una ventana que no avanza", () => {
    // Arreglar solo el campo malo daria una ventana que nadie pidio.
    const s = parsePurgeSettings({ windowStartHour: 22, windowEndHour: 3 });
    expect(s.windowStartHour).toBe(defaultPurgeSettings.windowStartHour);
    expect(s.windowEndHour).toBe(defaultPurgeSettings.windowEndHour);
  });

  it("acepta una ventana normal", () => {
    const s = parsePurgeSettings({
      enabled: true,
      windowStartHour: 10,
      windowEndHour: 12,
      durationMinutes: 7,
    });
    expect(s).toMatchObject({
      enabled: true,
      windowStartHour: 10,
      windowEndHour: 12,
      durationMinutes: 7,
    });
  });

  it("recorta la duracion que no cabe en su ventana", () => {
    // 120 minutos en una ventana de una sola hora: la duracion se comia la
    // ventana entera, el sorteo se quedaba sin rango y la purga caia a las
    // 19:00:00 clavadas todos los dias.
    const s = parsePurgeSettings({
      enabled: true,
      durationMinutes: 120,
      windowStartHour: 19,
      windowEndHour: 20,
    });
    expect(s.durationMinutes).toBe(30);
    // Se recorta la duracion; la ventana que pidio el admin se respeta.
    expect(s.windowStartHour).toBe(19);
    expect(s.windowEndHour).toBe(20);
  });

  it("no toca una duracion que cabe de sobra", () => {
    // El recorte no puede convertirse en un impuesto sobre las configs sanas.
    const s = parsePurgeSettings({
      enabled: true,
      durationMinutes: 5,
      windowStartHour: 19,
      windowEndHour: 23,
    });
    expect(s.durationMinutes).toBe(5);
  });

  it("admite justo la mitad de la ventana y ni un minuto mas", () => {
    // 4 h de ventana: 120 minutos son exactamente la mitad y pasan enteros.
    expect(
      parsePurgeSettings({
        durationMinutes: 120,
        windowStartHour: 19,
        windowEndHour: 23,
      }).durationMinutes,
    ).toBe(120);
    // 3 h de ventana: los mismos 120 ya no caben y bajan a 90.
    expect(
      parsePurgeSettings({
        durationMinutes: 120,
        windowStartHour: 19,
        windowEndHour: 22,
      }).durationMinutes,
    ).toBe(90);
  });

  it("los valores por defecto no sufren el recorte", () => {
    // 5 minutos en una ventana de 4 h: si esto se moviera, el recorte estaria
    // cambiandole la purga a todos los grupos que nunca la tocaron.
    expect(parsePurgeSettings({}).durationMinutes).toBe(
      defaultPurgeSettings.durationMinutes,
    );
  });
});

describe("maxPurgeDurationMinutes", () => {
  it("es la mitad del ancho de la ventana", () => {
    expect(maxPurgeDurationMinutes(19, 23)).toBe(120);
    expect(maxPurgeDurationMinutes(19, 20)).toBe(30);
    expect(maxPurgeDurationMinutes(0, 24)).toBe(720);
  });

  it("nunca baja de 30 minutos, porque la ventana minima es de una hora", () => {
    // Si el tope pudiera dar 0, el recorte dejaria purgas de duracion cero.
    for (let hora = 0; hora < 24; hora += 1) {
      expect(maxPurgeDurationMinutes(hora, hora + 1)).toBeGreaterThanOrEqual(
        30,
      );
    }
  });
});

describe("parsePurgeState", () => {
  it("ignora lo que no sea un instante util", () => {
    expect(parsePurgeState({ scheduledForMs: "manana" })).toEqual({});
    expect(parsePurgeState({ openedAtMs: -5 })).toEqual({});
    expect(parsePurgeState(null)).toEqual({});
  });

  it("lee lo que si vale", () => {
    expect(parsePurgeState({ scheduledForMs: 123, openedAtMs: 456 })).toEqual({
      scheduledForMs: 123,
      openedAtMs: 456,
    });
  });
});

describe("scheduleNextPurge", () => {
  const s = ajustes({
    windowStartHour: 10,
    windowEndHour: 12,
    durationMinutes: 5,
  });

  it("cae dentro de la ventana", () => {
    const cuando = scheduleNextPurge(s, MEDIANOCHE, 0.5);
    expect(cuando).toBeGreaterThanOrEqual(MEDIANOCHE + 10 * HORA);
    expect(cuando).toBeLessThanOrEqual(MEDIANOCHE + 12 * HORA);
  });

  it("deja hueco para que quepa entera antes del cierre", () => {
    const cuando = scheduleNextPurge(s, MEDIANOCHE, 0.999999);
    // Con 5 minutos de duracion, no puede empezar despues de las 11:55.
    expect(cuando).toBeLessThanOrEqual(MEDIANOCHE + 12 * HORA - 5 * 60 * 1000);
  });

  it("si la ventana de hoy ya paso, se va a la de manana", () => {
    const porLaTarde = MEDIANOCHE + 20 * HORA;
    const cuando = scheduleNextPurge(s, porLaTarde, 0);
    expect(cuando).toBe(MEDIANOCHE + DIA + 10 * HORA);
  });

  it("siempre devuelve un instante futuro", () => {
    // Si devolviera uno pasado, el siguiente tick la abriria al instante y la
    // purga dejaria de ser una sorpresa.
    for (const roll of [0, 0.25, 0.5, 0.75, 0.999999]) {
      for (const hora of [0, 5, 10, 11, 15, 23]) {
        const ahora = MEDIANOCHE + hora * HORA;
        expect(scheduleNextPurge(s, ahora, roll)).toBeGreaterThan(ahora);
      }
    }
  });

  it("dos tiradas distintas dan horas distintas", () => {
    const a = scheduleNextPurge(s, MEDIANOCHE, 0.1);
    const b = scheduleNextPurge(s, MEDIANOCHE, 0.9);
    expect(a).not.toBe(b);
  });

  it("conserva rango aunque la duracion pedida no quepa en la ventana", () => {
    // Sin recorte, las dos tiradas daban las 19:00:00 clavadas: la purga
    // dejaba de ser una sorpresa y se convertia en la alarma que este modulo
    // existe para evitar.
    const estrecha = parsePurgeSettings({
      enabled: true,
      durationMinutes: 120,
      windowStartHour: 19,
      windowEndHour: 20,
    });
    const pronto = scheduleNextPurge(estrecha, MEDIANOCHE, 0);
    const tarde = scheduleNextPurge(estrecha, MEDIANOCHE, 0.999999);
    expect(tarde - pronto).toBeGreaterThanOrEqual(29 * 60_000);
  });

  it("ninguna config deja la purga abierta fuera de su ventana", () => {
    // Es la consecuencia grave: durante la purga los escudos de victima estan
    // apagados, asi que un minuto de mas es un minuto de robar en bucle en un
    // horario que el admin no autorizo.
    const ventanas = [
      [0, 1],
      [10, 12],
      [19, 20],
      [19, 23],
      [6, 15],
      [23, 24],
    ] as const;
    for (const [inicio, fin] of ventanas) {
      for (const pedida of [1, 5, 30, 60, 120]) {
        const cfg = parsePurgeSettings({
          enabled: true,
          durationMinutes: pedida,
          windowStartHour: inicio,
          windowEndHour: fin,
        });
        const abre = scheduleNextPurge(cfg, MEDIANOCHE, 0.999999);
        const cierraLaVentana =
          Math.floor(abre / DIA) * DIA + cfg.windowEndHour * HORA;
        expect(abre + cfg.durationMinutes * 60_000).toBeLessThanOrEqual(
          cierraLaVentana,
        );
      }
    }
  });

  it("no deja ningun instante que caiga dentro de la purga todos los dias", () => {
    // Si el rango del sorteo fuera mas estrecho que la propia purga, el trozo
    // [ultimoInicio, desde + duracion) quedaria dentro de ella caiga donde
    // caiga la tirada: bastaria aparecer a esa hora para pillarla siempre.
    const ventanas = [
      [0, 1],
      [10, 12],
      [19, 20],
      [19, 23],
      [6, 15],
    ] as const;
    for (const [inicio, fin] of ventanas) {
      const cfg = parsePurgeSettings({
        enabled: true,
        durationMinutes: 120,
        windowStartHour: inicio,
        windowEndHour: fin,
      });
      const duracionMs = cfg.durationMinutes * 60_000;
      const rangoDelSorteoMs = (fin - inicio) * HORA - duracionMs;
      expect(rangoDelSorteoMs).toBeGreaterThanOrEqual(duracionMs);
    }
  });
});

describe("decidePurge", () => {
  const s = ajustes({
    windowStartHour: 10,
    windowEndHour: 12,
    durationMinutes: 5,
  });

  it("programa la primera cuando no hay nada guardado", () => {
    const res = decidePurge({
      settings: s,
      state: {},
      nowMs: MEDIANOCHE,
      roll: 0.5,
    });
    expect(res.kind).toBe("schedule");
  });

  it("no programa nada si esta apagada", () => {
    const res = decidePurge({
      settings: ajustes({ enabled: false }),
      state: {},
      nowMs: MEDIANOCHE,
      roll: 0.5,
    });
    expect(res.kind).toBe("none");
  });

  it("espera callada hasta que llega la hora", () => {
    const res = decidePurge({
      settings: s,
      state: { scheduledForMs: MEDIANOCHE + 10 * HORA },
      nowMs: MEDIANOCHE + 9 * HORA,
      roll: 0.5,
    });
    expect(res.kind).toBe("none");
  });

  it("abre en cuanto llega la hora", () => {
    const res = decidePurge({
      settings: s,
      state: { scheduledForMs: MEDIANOCHE + 10 * HORA },
      nowMs: MEDIANOCHE + 10 * HORA,
      roll: 0.5,
    });
    expect(res.kind).toBe("open");
  });

  it("mientras esta abierta no hace nada", () => {
    const res = decidePurge({
      settings: s,
      state: { openedAtMs: MEDIANOCHE + 10 * HORA },
      nowMs: MEDIANOCHE + 10 * HORA + 2 * 60 * 1000,
      roll: 0.5,
    });
    expect(res.kind).toBe("none");
  });

  it("la cierra al cumplirse la duracion y programa la siguiente", () => {
    const res = decidePurge({
      settings: s,
      state: { openedAtMs: MEDIANOCHE + 10 * HORA },
      nowMs: MEDIANOCHE + 10 * HORA + 5 * 60 * 1000,
      roll: 0.5,
    });
    expect(res.kind).toBe("close");
  });

  it("cierra una purga en marcha aunque la hayan apagado a media", () => {
    // Apagarla no puede dejar una abierta para siempre.
    const res = decidePurge({
      settings: ajustes({ enabled: false, durationMinutes: 5 }),
      state: { openedAtMs: MEDIANOCHE },
      nowMs: MEDIANOCHE + 10 * 60 * 1000,
      roll: 0.5,
    });
    expect(res.kind).toBe("close");
  });

  it("no abre a deshora cuando el worker estuvo caido", () => {
    // La hora paso hace una hora: abrirla ahora seria abrirla cuando no toca.
    const res = decidePurge({
      settings: s,
      state: { scheduledForMs: MEDIANOCHE + 10 * HORA },
      nowMs: MEDIANOCHE + 11 * HORA,
      roll: 0.5,
    });
    expect(res.kind).toBe("schedule");
  });
});

describe("renderPurgeBoard", () => {
  const euros = (n: number) => `${n} 🪙`;

  it("enseña el tiempo que queda en minutos y segundos", () => {
    const t = renderPurgeBoard({
      remainingSeconds: 222,
      totalMoved: 0,
      plays: [],
      top: [],
      formatAmount: euros,
    });
    expect(t).toContain("quedan 3:42");
  });

  it("rellena los segundos a dos cifras", () => {
    // "quedan 3:5" se lee como tres minutos y medio.
    const t = renderPurgeBoard({
      remainingSeconds: 185,
      totalMoved: 0,
      plays: [],
      top: [],
      formatAmount: euros,
    });
    expect(t).toContain("quedan 3:05");
  });

  it("cuenta los golpes y los fallos distinto", () => {
    const t = renderPurgeBoard({
      remainingSeconds: 60,
      totalMoved: 300,
      plays: [
        { thief: "Ana", victim: "Ben", amount: 238, success: true },
        { thief: "Ben", victim: "Ana", amount: 250, success: false },
      ],
      top: [],
      formatAmount: euros,
    });
    expect(t).toContain("🥷 Ana le robó 238 🪙 a Ben");
    expect(t).toContain("🚨 Ben fue pillado: pagó 250 🪙 a Ana");
  });

  it("solo enseña las cinco ultimas jugadas", () => {
    const plays = Array.from({ length: 9 }, (_, i) => ({
      thief: `L${i}`,
      victim: "V",
      amount: 10,
      success: true,
    }));
    const t = renderPurgeBoard({
      remainingSeconds: 60,
      totalMoved: 90,
      plays,
      top: [],
      formatAmount: euros,
    });
    expect(t).toContain("L0");
    expect(t).toContain("L4");
    // Mas de cinco obligaria a hacer scroll para ver el marcador.
    expect(t).not.toContain("L5");
  });

  it("al terminar cambia el titulo y quita la llamada a robar", () => {
    const t = renderPurgeBoard({
      remainingSeconds: 0,
      totalMoved: 500,
      plays: [],
      top: [{ name: "Ana", amount: 500 }],
      formatAmount: euros,
    });
    expect(t).toContain("HA TERMINADO");
    expect(t).not.toContain("/robar");
    expect(t).toContain("🏆 Ana 500 🪙");
  });

  it("aguanta una purga en la que nadie ha robado todavia", () => {
    const t = renderPurgeBoard({
      remainingSeconds: 300,
      totalMoved: 0,
      plays: [],
      top: [],
      formatAmount: euros,
    });
    expect(t).toContain("LA PURGA");
    expect(t).toContain("0 🪙");
  });
});

describe("isPurgeOpen", () => {
  const s = ajustes({ durationMinutes: 5 });

  it("no hay purga si no se abrio ninguna", () => {
    expect(isPurgeOpen({}, s, MEDIANOCHE)).toBe(false);
  });

  it("esta abierta dentro de su duracion", () => {
    expect(
      isPurgeOpen({ openedAtMs: MEDIANOCHE }, s, MEDIANOCHE + 60_000),
    ).toBe(true);
  });

  it("deja de estarlo justo al cumplirse", () => {
    expect(
      isPurgeOpen({ openedAtMs: MEDIANOCHE }, s, MEDIANOCHE + 5 * 60_000),
    ).toBe(false);
  });

  it("no sigue abierta despues de que cierre la ventana", () => {
    // 120 minutos en una ventana de una hora la mantenian abierta hasta las
    // 21:00 con la ventana cerrada a las 20:00. Esa hora de mas es robar con
    // los escudos de victima apagados en un horario que nadie autorizo.
    const estrecha = parsePurgeSettings({
      enabled: true,
      durationMinutes: 120,
      windowStartHour: 19,
      windowEndHour: 20,
    });
    const abrio = MEDIANOCHE + 19 * HORA;
    expect(isPurgeOpen({ openedAtMs: abrio }, estrecha, abrio + 60_000)).toBe(
      true,
    );
    expect(
      isPurgeOpen({ openedAtMs: abrio }, estrecha, MEDIANOCHE + 20 * HORA),
    ).toBe(false);
  });
});

describe("el marcador y las fichas", () => {
  const euros = (n: number) => `${n} 🪙`;

  const marcador = (jugada: PurgePlay): string =>
    renderPurgeBoard({
      remainingSeconds: 60,
      totalMoved: 0,
      plays: [jugada],
      top: [],
      formatAmount: euros,
    });

  it("sin fichas escribe lo de siempre", () => {
    const t = marcador({
      thief: "Ana",
      victim: "Beto",
      amount: 500,
      success: true,
    });
    expect(t).toContain("Ana le robó 500 🪙 a Beto");
  });

  it("desglosa cuando parte del botin salio de las fichas", () => {
    // Sin esto la linea decia "500 🪙" cuando solo 2 eran monedas.
    const t = marcador({
      thief: "Ana",
      victim: "Beto",
      amount: 500,
      fromChips: 498,
      success: true,
    });
    expect(t).toContain("Ana le robó 2 🪙 y 498 fichas a Beto");
    expect(t).not.toContain("500 🪙");
  });

  it("dice solo fichas cuando no habia monedas sueltas", () => {
    const t = marcador({
      thief: "Ana",
      victim: "Beto",
      amount: 300,
      fromChips: 300,
      success: true,
    });
    expect(t).toContain("Ana le robó 300 fichas a Beto");
  });

  it("la multa nunca se desglosa: la paga el ladron de sus monedas", () => {
    const t = marcador({
      thief: "Ana",
      victim: "Beto",
      amount: 120,
      fromChips: 99,
      success: false,
    });
    expect(t).toContain("pagó 120 🪙 a Beto");
    expect(t).not.toContain("fichas");
  });
});

describe("apagar la purga la corta de verdad", () => {
  const abierta = { openedAtMs: 1_000_000 };
  const ajustes = (enabled: boolean) =>
    parsePurgeSettings({ enabled, durationMinutes: 30 });

  it("encendida y dentro de la ventana: abierta", () => {
    expect(isPurgeOpen(abierta, ajustes(true), 1_000_000 + 60_000)).toBe(true);
  });

  it("apagada en los ajustes: cerrada, aunque la ventana siga viva", () => {
    // Este es el fallo que tenia: quien la apagaba porque se le estaba yendo
    // de las manos creia haberla parado y seguia media hora corriendo.
    expect(isPurgeOpen(abierta, ajustes(false), 1_000_000 + 60_000)).toBe(
      false,
    );
  });

  it("apagarla hace que el worker la CIERRE, no que la deje colgada", () => {
    // `decidePurge` ya decia en su comentario que apagarla a media purga no
    // podia dejar una abierta para siempre. Sin el arreglo nunca llegaba a
    // cerrar, porque `isPurgeOpen` no miraba `enabled`.
    const accion = decidePurge({
      settings: ajustes(false),
      state: abierta,
      nowMs: 1_000_000 + 60_000,
      roll: 0.5,
    });
    expect(accion.kind).toBe("close");
  });

  it("y una vez cerrada, apagada no vuelve a programar nada", () => {
    const accion = decidePurge({
      settings: ajustes(false),
      state: {},
      nowMs: 1_000_000,
      roll: 0.5,
    });
    expect(accion.kind).toBe("none");
  });
});
