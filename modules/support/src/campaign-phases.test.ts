import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_PHASES,
  type CampaignSlot,
  campaignSchedule,
  nextCampaignPhase,
} from "./campaign-phases.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Instante de evento fijo y arbitrario para las pruebas.
const EVENT = 1_000_000_000_000;

const slotFor = (
  phase: CampaignSlot["phase"],
  slots: readonly CampaignSlot[],
): CampaignSlot => {
  const found = slots.find((slot) => slot.phase === phase);
  if (found === undefined) {
    throw new Error(`fase no encontrada: ${phase}`);
  }
  return found;
};

describe("CAMPAIGN_PHASES", () => {
  it("define exactamente las cuatro fases esperadas", () => {
    expect(CAMPAIGN_PHASES.map((entry) => entry.phase)).toEqual([
      "teaser",
      "anuncio",
      "recordatorio",
      "cierre",
    ]);
  });

  it("usa los offsets relativos al evento acordados", () => {
    const byPhase = new Map(
      CAMPAIGN_PHASES.map((entry) => [entry.phase, entry.offsetMs]),
    );
    expect(byPhase.get("teaser")).toBe(-7 * DAY);
    expect(byPhase.get("anuncio")).toBe(-1 * DAY);
    expect(byPhase.get("recordatorio")).toBe(-1 * HOUR);
    expect(byPhase.get("cierre")).toBe(1 * HOUR);
  });

  it("mantiene los offsets en orden cronologico ascendente", () => {
    const offsets = CAMPAIGN_PHASES.map((entry) => entry.offsetMs);
    const sorted = [...offsets].sort((a, b) => a - b);
    expect(offsets).toEqual(sorted);
  });
});

describe("campaignSchedule", () => {
  it("resuelve cada fase sumando su offset al evento", () => {
    const slots = campaignSchedule(EVENT);
    expect(slotFor("teaser", slots).whenMs).toBe(EVENT - 7 * DAY);
    expect(slotFor("anuncio", slots).whenMs).toBe(EVENT - DAY);
    expect(slotFor("recordatorio", slots).whenMs).toBe(EVENT - HOUR);
    expect(slotFor("cierre", slots).whenMs).toBe(EVENT + HOUR);
  });

  it("devuelve un slot por cada fase definida", () => {
    expect(campaignSchedule(EVENT)).toHaveLength(CAMPAIGN_PHASES.length);
  });

  it("conserva el orden cronologico de las fases", () => {
    const slots = campaignSchedule(EVENT);
    expect(slots.map((slot) => slot.phase)).toEqual([
      "teaser",
      "anuncio",
      "recordatorio",
      "cierre",
    ]);
    const whens = slots.map((slot) => slot.whenMs);
    expect([...whens].sort((a, b) => a - b)).toEqual(whens);
  });

  it("funciona con evento en el origen de tiempo (0)", () => {
    const slots = campaignSchedule(0);
    expect(slotFor("teaser", slots).whenMs).toBe(-7 * DAY);
    expect(slotFor("cierre", slots).whenMs).toBe(HOUR);
  });

  it("es determinista para la misma entrada", () => {
    expect(campaignSchedule(EVENT)).toEqual(campaignSchedule(EVENT));
  });
});

describe("nextCampaignPhase", () => {
  it("devuelve teaser mucho antes del evento", () => {
    const next = nextCampaignPhase(EVENT, EVENT - 30 * DAY);
    expect(next).toEqual({ phase: "teaser", whenMs: EVENT - 7 * DAY });
  });

  it("salta el teaser una vez pasado su instante", () => {
    const next = nextCampaignPhase(EVENT, EVENT - 3 * DAY);
    expect(next).toEqual({ phase: "anuncio", whenMs: EVENT - DAY });
  });

  it("devuelve recordatorio entre el anuncio y la hora previa", () => {
    const next = nextCampaignPhase(EVENT, EVENT - 2 * HOUR);
    expect(next).toEqual({ phase: "recordatorio", whenMs: EVENT - HOUR });
  });

  it("devuelve cierre justo despues del evento", () => {
    const next = nextCampaignPhase(EVENT, EVENT + 1 * MINUTE);
    expect(next).toEqual({ phase: "cierre", whenMs: EVENT + HOUR });
  });

  it("trata el instante exacto de una fase como ya pasado (comparacion estricta)", () => {
    const next = nextCampaignPhase(EVENT, EVENT - HOUR);
    expect(next).toEqual({ phase: "cierre", whenMs: EVENT + HOUR });
  });

  it("devuelve null cuando ya pasaron todas las fases", () => {
    expect(nextCampaignPhase(EVENT, EVENT + 2 * HOUR)).toBeNull();
  });

  it("devuelve null en el instante exacto del cierre", () => {
    expect(nextCampaignPhase(EVENT, EVENT + HOUR)).toBeNull();
  });

  it("coincide con el primer slot futuro del schedule", () => {
    const now = EVENT - 5 * DAY;
    const firstFuture = campaignSchedule(EVENT).find(
      (slot) => slot.whenMs > now,
    );
    expect(nextCampaignPhase(EVENT, now)).toEqual(firstFuture ?? null);
  });

  it("es determinista para la misma entrada", () => {
    const now = EVENT - 10 * HOUR;
    expect(nextCampaignPhase(EVENT, now)).toEqual(
      nextCampaignPhase(EVENT, now),
    );
  });
});
