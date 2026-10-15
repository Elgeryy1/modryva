import { describe, expect, it } from "vitest";

import {
  type DecisionInput,
  type DecisionSettingsInput,
  evaluateDecision,
} from "./decision-engine.js";

/**
 * Una senal AUSENTE no es una senal conforme.
 *
 * `gestureScore` y `faceCount` son `null` cuando el modelo **no los juzgo**
 * —el propio prompt le pide que sea conservador si duda—, y el motor lo trataba
 * como conforme por dos caminos a la vez: la confianza es el eslabon mas debil
 * DE LOS QUE HAY, asi que perder una senal la sube en vez de bajarla, y las
 * guardas de minimo son `!== null && ...`, asi que con `null` no saltan.
 *
 * El resultado era **auto-aprobar a quien no hizo el gesto**.
 */

const AJUSTES: DecisionSettingsInput = {
  mode: "auto",
  autoApproveThreshold: 0.85,
  manualReviewThreshold: 0.55,
  livenessMinimum: 0.6,
  gestureMinimum: 0.6,
  replayRiskMaximum: 0.4,
  syntheticRiskMaximum: 0.4,
  requireSingleFace: true,
  allowAutomaticDecline: false,
  minimumAge: null,
  maximumAge: null,
  requiredPhotos: 1,
  allowedCountries: [],
};

const FUERTE: DecisionInput = {
  settings: AJUSTES,
  attemptsRemaining: 2,
  integrityViolation: null,
  pipelineError: false,
  signals: {
    faceCount: 1,
    challengeCompleted: true,
    gestureScore: 0.95,
    qualityScore: 0.9,
    livenessScore: 0.95,
    livenessStatus: "success",
    replayRisk: 0.02,
    syntheticMediaRisk: 0.02,
    syntheticStatus: "success",
    provenanceStatus: "c2pa_not_found",
    estimatedAgeMin: null,
    estimatedAgeMax: null,
    ageStatus: "not_evaluated",
    samePersonStatus: "not_evaluated",
    samePersonMatch: null,
    secondGestureStatus: "not_evaluated",
    secondGesturePresent: null,
    secondGestureDistinct: null,
    countryCode: null,
    hardFailures: [],
  },
};

const con = (
  senales: Partial<DecisionInput["signals"]>,
  ajustes: Partial<DecisionSettingsInput> = {},
): DecisionInput => ({
  ...FUERTE,
  settings: { ...AJUSTES, ...ajustes },
  signals: { ...FUERTE.signals, ...senales },
});

describe("el gesto sin juzgar no puede auto-aprobar", () => {
  it("con todas las senales, auto-aprueba", () => {
    // El control: sin esto, el de abajo podria pasar por otro motivo.
    expect(evaluateDecision(FUERTE).decision).toBe("auto_approve");
  });

  it("con el gesto SIN JUZGAR va a revision, no a auto-aprobar", () => {
    // El agujero: alguien que no hizo el gesto entraba solo, siempre que el
    // modelo dijera "persona real" y se callara sobre el gesto. La
    // verificacion se degradaba a "hay una cara de una persona real", que es
    // lo que cumple cualquier selfie reciclado.
    const r = evaluateDecision(con({ gestureScore: null }));

    expect(r.decision).toBe("manual_review");
    expect(r.reasonCode).toBe("signal_unverified");
    expect(r.explanation.codes).toContain("gesture_not_evaluated");
  });

  it("con el gesto CONFIRMADO ausente sigue por su camino de siempre", () => {
    // 0 no es null: el modelo SI juzgo, y dijo que no estaba. Ese caso ya
    // funcionaba y no se toca.
    const r = evaluateDecision(con({ gestureScore: 0 }));

    expect(r.decision).not.toBe("auto_approve");
    expect(r.reasonCode).not.toBe("signal_unverified");
  });

  it("no rechaza a nadie: lo manda a que lo mire una persona", () => {
    // La direccion importa. Con Guardian dejando gente fuera como incidencia
    // abierta, el arreglo no puede ser rechazar mas.
    expect(evaluateDecision(con({ gestureScore: null })).decision).toBe(
      "manual_review",
    );
  });
});

describe("el recuento de caras sin juzgar tampoco", () => {
  it("con requireSingleFace y faceCount null va a revision", () => {
    const r = evaluateDecision(
      con({ faceCount: null }, { requireSingleFace: true }),
    );

    expect(r.decision).toBe("manual_review");
    expect(r.explanation.codes).toContain("face_count_not_evaluated");
  });

  it("sin requireSingleFace, un recuento nulo no estorba", () => {
    // El grupo no pidio una sola cara, asi que no saber cuantas hay no es
    // evidencia que falte: no se puede exigir lo que nadie pidio.
    const r = evaluateDecision(
      con({ faceCount: null }, { requireSingleFace: false }),
    );

    expect(r.decision).toBe("auto_approve");
  });
});

describe("solo interviene en el camino de auto-aprobar", () => {
  it("por debajo del umbral, el motivo sigue siendo el concreto de antes", () => {
    // Pisarlo empeoraria el mensaje sin cerrar nada: ya iba a revision o a
    // reintento, y con un motivo que dice mas.
    const r = evaluateDecision(
      con({ gestureScore: null, qualityScore: 0.2, livenessScore: 0.2 }),
    );

    expect(r.reasonCode).not.toBe("signal_unverified");
  });
});
