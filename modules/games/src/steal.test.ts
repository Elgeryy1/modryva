import { describe, expect, it } from "vitest";
import {
  defaultStealSettings,
  describirBotin,
  MAX_TOTAL_CHANCE_PCT,
  resolveSteal,
  type StealInput,
  type StealSettings,
  stealChancePct,
} from "./steal.js";

const AHORA = 1_000_000_000_000;

const ajustes = (over: Partial<StealSettings> = {}): StealSettings => ({
  ...defaultStealSettings,
  enabled: true,
  ...over,
});

const intento = (over: Partial<StealInput> = {}): StealInput => ({
  settings: ajustes(),
  nowMs: AHORA,
  thiefBalance: 1000,
  victimBalance: 1000,
  successfulSteals: 0,
  lastStealMs: undefined,
  victimLastRobbedMs: undefined,
  samePerson: false,
  roll: 0.1,
  purge: false,
  ...over,
});

describe("stealChancePct", () => {
  it("parte de la probabilidad base sin experiencia", () => {
    expect(stealChancePct(ajustes(), 0, false)).toBe(35);
  });

  it("sube con los robos acumulados", () => {
    expect(stealChancePct(ajustes(), 5, false)).toBe(45);
  });

  it("no pasa del techo por mucha experiencia que se tenga", () => {
    expect(stealChancePct(ajustes(), 1000, false)).toBe(60);
  });

  it("la purga empuja por encima del techo, que es lo que la hace un evento", () => {
    // 60 de techo + 20 del evento. Antes eran 95, que dejaba robar casi siempre.
    expect(stealChancePct(ajustes(), 1000, true)).toBe(80);
  });

  it("nunca pasa del 100 aunque los ajustes sean absurdos", () => {
    expect(stealChancePct(ajustes({ maxChancePct: 200 }), 1000, true)).toBe(
      100,
    );
  });
});

describe("resolveSteal", () => {
  it("no se le puede robar a una cartera con saldo sin fondo", () => {
    // No es un favor: el golpe ACUNABA moneda. El saldo de la victima esta
    // congelado, asi que no perdia nada, y al ladron se le pagaba el botin
    // igual. Con la tirada a 0 el robo saldria bien; lo para la cartera.
    const salida = resolveSteal(intento({ victimUnlimited: true, roll: 0 }));

    expect(salida.attempted).toBe(false);
    expect(salida.refusal).toBe("victim-unlimited");
  });

  it("y no hay evento ni objeto que levante esa inmunidad", () => {
    // La purga se salta el escudo y las esperas, y el guante y la navaja se
    // saltan lo suyo. Esto no: no protege un saldo, dice que no hay saldo que
    // proteger.
    const salida = resolveSteal(
      intento({
        victimUnlimited: true,
        purge: true,
        roll: 0,
        modifiers: { ignoreCooldown: true, ignoreVictimShield: true },
      }),
    );

    expect(salida.refusal).toBe("victim-unlimited");
  });

  it("sin el campo se comporta exactamente igual que antes", () => {
    // La bandera es opcional a proposito: ninguna llamada vieja cambia.
    expect(resolveSteal(intento({ roll: 0 })).attempted).toBe(true);
  });

  it("no hace nada si esta apagado", () => {
    const res = resolveSteal(
      intento({ settings: ajustes({ enabled: false }) }),
    );
    expect(res).toMatchObject({ attempted: false, refusal: "disabled" });
  });

  it("no deja robarse a uno mismo", () => {
    const res = resolveSteal(intento({ samePerson: true }));
    expect(res.refusal).toBe("self");
  });

  it("respeta la espera del ladron y dice cuanto falta", () => {
    const res = resolveSteal(
      intento({ lastStealMs: AHORA - 60_000, settings: ajustes() }),
    );
    expect(res.refusal).toBe("cooldown");
    // 1800s de cooldown menos los 60 que han pasado.
    expect(res.retryAfterSeconds).toBe(1740);
  });

  it("respeta el escudo de la victima recien robada", () => {
    const res = resolveSteal(intento({ victimLastRobbedMs: AHORA - 60_000 }));
    expect(res.refusal).toBe("shielded");
    expect(res.retryAfterSeconds).toBe(3540);
  });

  it("deja robar cuando la espera ya paso", () => {
    const res = resolveSteal(intento({ lastStealMs: AHORA - 3_600_000 }));
    expect(res.attempted).toBe(true);
  });

  it("protege a quien casi no tiene nada", () => {
    const res = resolveSteal(intento({ victimBalance: 10 }));
    expect(res.refusal).toBe("victim-too-poor");
  });

  it("no deja robar a quien no podria pagar la multa", () => {
    // Sin esto, el que esta a cero roba gratis: gana a veces y no pierde nunca.
    const res = resolveSteal(intento({ thiefBalance: 0 }));
    expect(res.refusal).toBe("thief-broke");
  });

  it("un grupo con la multa a 0 sigue dejando robar", () => {
    // El 0 de un campo numerico editado a mano es "no he puesto multa", no "el
    // ladron esta seco". Confundirlos apagaba /robar para todo el grupo y
    // encima le echaba la culpa al jugador, que tenia 1.000 en la cartera.
    const sinPorcentaje = resolveSteal(
      intento({ roll: 0.99, settings: ajustes({ finePct: 0 }) }),
    );
    expect(sinPorcentaje).toMatchObject({
      attempted: true,
      success: false,
      amount: 0,
    });

    const sinTope = resolveSteal(
      intento({ roll: 0.99, settings: ajustes({ fineMax: 0 }) }),
    );
    expect(sinTope).toMatchObject({
      attempted: true,
      success: false,
      amount: 0,
    });
  });

  it("sin multa configurada tampoco se cobra al que no tiene nada", () => {
    // Los dos ceros a la vez: el grupo no puso multa Y el ladron esta seco.
    // Manda el del grupo, porque no hay nada que cobrar.
    const res = resolveSteal(
      intento({
        thiefBalance: 0,
        roll: 0.99,
        settings: ajustes({ finePct: 0 }),
      }),
    );
    expect(res).toMatchObject({ attempted: true, amount: 0 });
    expect(res.refusal).toBeUndefined();
  });

  it("con multa configurada, el ladron seco sigue sin poder robar", () => {
    // El arreglo del cero del grupo no puede abrirle la puerta a quien de
    // verdad no tiene con que responder: ese es el caso que nombra el rechazo.
    const res = resolveSteal(
      intento({ thiefBalance: 0, settings: ajustes({ finePct: 10 }) }),
    );
    expect(res.refusal).toBe("thief-broke");
  });

  it("entra cuando la tirada cae por debajo de la probabilidad", () => {
    const res = resolveSteal(intento({ roll: 0.34 }));
    expect(res).toMatchObject({ attempted: true, success: true, amount: 200 });
  });

  it("falla cuando la tirada la supera, y cobra multa", () => {
    const res = resolveSteal(intento({ roll: 0.36 }));
    expect(res).toMatchObject({ attempted: true, success: false, amount: 100 });
  });

  it("el limite es estricto: justo en la probabilidad, falla", () => {
    // roll * 100 < chance. Con 0.35 y 35% da 35 < 35 = false.
    expect(resolveSteal(intento({ roll: 0.35 })).success).toBe(false);
    expect(resolveSteal(intento({ roll: 0.3499 })).success).toBe(true);
  });

  it("topa el botin por mucho que tenga la victima", () => {
    const res = resolveSteal(intento({ victimBalance: 1_000_000, roll: 0 }));
    expect(res.amount).toBe(defaultStealSettings.lootMax);
  });

  it("topa la multa por mucho que tenga el ladron", () => {
    const res = resolveSteal(intento({ thiefBalance: 1_000_000, roll: 0.99 }));
    expect(res.amount).toBe(defaultStealSettings.fineMax);
  });

  it("nunca roba 0: un exito tiene que notarse", () => {
    const res = resolveSteal(
      intento({
        victimBalance: 4,
        roll: 0,
        settings: ajustes({ minVictimBalance: 1, lootPct: 10 }),
      }),
    );
    // El 10% de 4 redondea a 0; el suelo lo sube a 1.
    expect(res.amount).toBe(1);
  });

  it("la caja fuerte no se puede robar", () => {
    // 6.020 de saldo con 5.000 guardados: solo 1.020 estan expuestos.
    const res = resolveSteal(
      intento({ victimBalance: 6020, victimProtected: 5000, roll: 0 }),
    );
    // 20% de 1.020, no de 6.020.
    expect(res.amount).toBe(204);
  });

  it("con todo guardado, no es objetivo", () => {
    const res = resolveSteal(
      intento({ victimBalance: 6020, victimProtected: 6020 }),
    );
    expect(res.refusal).toBe("victim-too-poor");
  });

  it("el botin nunca se lleva mas de lo expuesto", () => {
    // Un porcentaje alto sobre un saldo grande podria pasarse de lo que hay
    // fuera de la caja fuerte y vaciarla por la puerta de atras.
    const res = resolveSteal(
      intento({
        victimBalance: 10_000,
        victimProtected: 9_900,
        roll: 0,
        settings: ajustes({ lootPct: 90, lootMax: 100_000 }),
      }),
    );
    expect(res.amount).toBeLessThanOrEqual(100);
  });

  it("sin caja fuerte se comporta igual que antes", () => {
    const conCampo = resolveSteal(intento({ victimProtected: 0, roll: 0 }));
    const sinCampo = resolveSteal(intento({ roll: 0 }));
    expect(conCampo.amount).toBe(sinCampo.amount);
  });

  it("durante la purga se ignora el escudo de la victima", () => {
    // Si no, media hora despues del primer golpe no quedaria nadie a quien
    // robar y el evento se apagaria solo.
    const res = resolveSteal(
      intento({
        victimLastRobbedMs: AHORA - 1000,
        purge: true,
        roll: 0.5,
      }),
    );
    expect(res.attempted).toBe(true);
    // 35 base + 20 de purga = 55, y 50 < 55 entra.
    expect(res).toMatchObject({ success: true, chancePct: 55 });
  });

  it("en purga la espera se acorta, no desaparece", () => {
    // Robo hace 4 s con 10 s de espera de purga: todavia no.
    const pronto = resolveSteal(
      intento({ lastStealMs: AHORA - 4000, purge: true }),
    );
    expect(pronto.refusal).toBe("cooldown");
    expect(pronto.retryAfterSeconds).toBe(6);

    // Pasados los 10 s, adelante. Fuera de purga seguiria esperando media hora.
    const ya = resolveSteal(
      intento({ lastStealMs: AHORA - 11_000, purge: true }),
    );
    expect(ya.attempted).toBe(true);
    expect(
      resolveSteal(intento({ lastStealMs: AHORA - 11_000, purge: false }))
        .refusal,
    ).toBe("cooldown");
  });

  it("con la espera de purga a 0 vuelve a ser barra libre", () => {
    const res = resolveSteal(
      intento({
        lastStealMs: AHORA - 1000,
        purge: true,
        settings: ajustes({ purgeCooldownSeconds: 0 }),
      }),
    );
    expect(res.attempted).toBe(true);
  });

  it("la purga no salta el suelo de saldo de la victima", () => {
    // Que sea barra libre de horarios no significa barra libre de cebarse con
    // el que no tiene nada.
    const res = resolveSteal(intento({ purge: true, victimBalance: 10 }));
    expect(res.refusal).toBe("victim-too-poor");
  });
});

describe("objetos comprados", () => {
  it("la navaja sube la probabilidad", () => {
    expect(stealChancePct(ajustes(), 0, false, { attackerBonusPct: 25 })).toBe(
      60,
    );
  });

  it("el escudo la baja", () => {
    expect(stealChancePct(ajustes(), 0, false, { victimGuardPct: 25 })).toBe(
      10,
    );
  });

  it("navaja contra escudo se anulan", () => {
    expect(
      stealChancePct(ajustes(), 0, false, {
        attackerBonusPct: 25,
        victimGuardPct: 25,
      }),
    ).toBe(35);
  });

  it("lo comprado no puede pasar del tope duro", () => {
    // 60 de techo + 20 de purga + 25 de navaja darian 105. Comprar una ventaja
    // tiene que seguir siendo una apuesta.
    expect(
      stealChancePct(ajustes(), 1000, true, { attackerBonusPct: 25 }),
    ).toBe(MAX_TOTAL_CHANCE_PCT);
  });

  it("el tope duro no le baja la probabilidad a quien ya la tenia", () => {
    // Un grupo que configure el 100 se queda en 100: bajarlo desde aqui seria
    // decidir por el admin. Lo que no puede es que TE SUBA ahi lo comprado.
    const alMaximo = ajustes({ maxChancePct: 100 });
    expect(
      stealChancePct(alMaximo, 1000, false, { attackerBonusPct: 25 }),
    ).toBe(100);
  });

  it("el cafe se salta la espera", () => {
    const conEspera = intento({ lastStealMs: AHORA - 60_000 });
    expect(resolveSteal(conEspera).refusal).toBe("cooldown");
    expect(
      resolveSteal({ ...conEspera, modifiers: { ignoreCooldown: true } })
        .attempted,
    ).toBe(true);
  });

  it("la ganzua se salta el escudo de la victima", () => {
    const protegida = intento({ victimLastRobbedMs: AHORA - 60_000 });
    expect(resolveSteal(protegida).refusal).toBe("shielded");
    expect(
      resolveSteal({ ...protegida, modifiers: { ignoreVictimShield: true } })
        .attempted,
    ).toBe(true);
  });

  it("el guante deja fallar sin pagar", () => {
    const fallo = intento({ roll: 0.99, modifiers: { skipFine: true } });
    const res = resolveSteal(fallo);
    expect(res).toMatchObject({ attempted: true, success: false, amount: 0 });
  });

  it("con guante puede robar quien no tendria para la multa", () => {
    // Sin el, quien esta a cero se come un "no te llega ni para la multa". Con
    // el, ha pagado por adelantado el derecho a fallar gratis.
    const sinNada = intento({ thiefBalance: 0, roll: 0.99 });
    expect(resolveSteal(sinNada).refusal).toBe("thief-broke");
    expect(
      resolveSteal({ ...sinNada, modifiers: { skipFine: true } }).attempted,
    ).toBe(true);
  });

  it("el saco dobla el botin, no solo su tope", () => {
    // 1.000 expuestos al 20% son 200; con saco, 400. Subiendo solo el tope
    // (500) no habria cambiado nada, que era el fallo de la primera version.
    const golpe = intento({ victimBalance: 1000, roll: 0 });
    expect(resolveSteal(golpe).amount).toBe(200);
    expect(
      resolveSteal({ ...golpe, modifiers: { lootMultiplier: 2 } }).amount,
    ).toBe(400);
  });

  it("el saco no puede llevarse mas de lo que hay fuera de la caja fuerte", () => {
    const golpe = intento({
      victimBalance: 1000,
      victimProtected: 900,
      roll: 0,
      modifiers: { lootMultiplier: 2 },
    });
    // Expuestos hay 100: el 20% doblado son 40, y el techo del expuesto manda.
    expect(resolveSteal(golpe).amount).toBe(40);
  });

  it("sin objetos se comporta exactamente igual que antes", () => {
    const golpe = intento({ victimBalance: 1000, roll: 0 });
    expect(resolveSteal(golpe)).toEqual(
      resolveSteal({ ...golpe, modifiers: {} }),
    );
  });
});

describe("defensa comprada", () => {
  it("el comodin para el golpe incluso en purga", () => {
    // Es lo unico que para el evento. Comprobarlo despues de la purga habria
    // significado que justo cuando hace falta no sirve de nada.
    const enPurga = intento({ purge: true, modifiers: { victimImmune: true } });
    expect(resolveSteal(enPurga)).toMatchObject({
      attempted: false,
      refusal: "immune",
    });
  });

  it("el comodin no se gasta fuera de la purga", () => {
    // Quien llama consume el objeto al ver el rechazo "immune". Comprobarlo sin
    // mirar la purga significaba que un /robar cualquier martes le costaba a la
    // victima un objeto de 5.000 para pararle un golpe de 500 como mucho — y el
    // dia de la purga ya no le quedaba comodin.
    const fueraDePurga = intento({
      purge: false,
      modifiers: { victimImmune: true },
    });
    const res = resolveSteal(fueraDePurga);
    expect(res.attempted).toBe(true);
    expect(res.refusal).toBeUndefined();
  });

  it("fuera de la purga el comodin no cambia nada del desenlace", () => {
    // Ni protege ni estorba: el robo tiene que salir exactamente igual que si
    // la victima no llevara nada encima.
    const golpe = intento({ purge: false, victimBalance: 1000, roll: 0 });
    const conComodin = resolveSteal({
      ...golpe,
      modifiers: { victimImmune: true },
    });
    expect(conComodin).toEqual(resolveSteal(golpe));
  });

  it("el comodin gana a la espera y al escudo, pero solo dentro de la purga", () => {
    // Dentro del evento tiene que ir por delante de todo lo demas: si otra
    // comprobacion cortara antes, el objeto que para la purga no llegaria a
    // decir que la para.
    const enPurga = intento({
      purge: true,
      lastStealMs: AHORA - 1000,
      victimLastRobbedMs: AHORA - 1000,
      modifiers: { victimImmune: true },
    });
    expect(resolveSteal(enPurga).refusal).toBe("immune");
  });

  it("el espejo dobla la multa", () => {
    const fallo = intento({ roll: 0.99, thiefBalance: 1000 });
    // 10% de 1.000 son 100; con espejo, 200.
    expect(resolveSteal(fallo).amount).toBe(100);
    expect(
      resolveSteal({ ...fallo, modifiers: { fineMultiplier: 2 } }).amount,
    ).toBe(200);
  });

  it("la multa doblada nunca pasa del saldo del ladron", () => {
    // Si pasara, el cobro fallaria entero y la victima se quedaria SIN NADA:
    // el objeto que la protege la habria dejado peor que no tenerlo.
    const casiSeco = intento({
      roll: 0.99,
      thiefBalance: 150,
      settings: ajustes({ finePct: 100, fineMax: 1000 }),
      modifiers: { fineMultiplier: 2 },
    });
    expect(resolveSteal(casiSeco).amount).toBe(150);
  });

  it("el guante gana al espejo", () => {
    // Quien pago por no arriesgar, no arriesga.
    const fallo = intento({
      roll: 0.99,
      thiefBalance: 1000,
      modifiers: { fineMultiplier: 2, skipFine: true },
    });
    expect(resolveSteal(fallo).amount).toBe(0);
  });
});

describe("describirBotin", () => {
  const monedas = (n: number) => `${n} 🪙 monedas`;

  it("sin fichas escribe exactamente lo de siempre", () => {
    // Es el caso normal, y ese texto no tenia nada malo: no se toca.
    expect(
      describirBotin({ total: 500, deFichas: 0, formatMonedas: monedas }),
    ).toBe("500 🪙 monedas");
  });

  it("desglosa cuando parte del botin son fichas", () => {
    // El caso que reventó en vivo: el ladron leia "500 monedas" y la victima
    // habia perdido 2. Las dos cosas eran ciertas.
    expect(
      describirBotin({ total: 500, deFichas: 498, formatMonedas: monedas }),
    ).toBe("2 🪙 monedas y 498 fichas");
  });

  it("no nombra las monedas cuando no se llevo ninguna", () => {
    expect(
      describirBotin({ total: 498, deFichas: 498, formatMonedas: monedas }),
    ).toBe("498 fichas");
  });

  it("nunca dice mas fichas que botin total", () => {
    // Defensa contra un llamante que se cruce los numeros: preferimos decir
    // "todo fichas" antes que imprimir monedas negativas.
    expect(
      describirBotin({ total: 10, deFichas: 999, formatMonedas: monedas }),
    ).toBe("10 fichas");
  });

  it("trata un negativo como cero fichas", () => {
    expect(
      describirBotin({ total: 10, deFichas: -5, formatMonedas: monedas }),
    ).toBe("10 🪙 monedas");
  });
});
