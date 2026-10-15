import { describe, expect, it } from "vitest";
import { detectQrBait, QR_BAIT_NONE_KEY } from "./qr-bait.js";

describe("detectQrBait", () => {
  it("flags a plain 'escanea el QR' hook", () => {
    const signal = detectQrBait("Escanea el QR para entrar");
    expect(signal.present).toBe(true);
    expect(signal.key).toBe("qr-bait-scan-qr");
    expect(signal.detail).toBe("escanea el qr");
    expect(signal.weight).toBe(3);
  });

  it("flags a payment QR with higher weight", () => {
    const signal = detectQrBait("Manda el QR de pago aqui");
    expect(signal.present).toBe(true);
    expect(signal.key).toBe("qr-bait-payment");
    expect(signal.detail).toBe("qr de pago");
    expect(signal.weight).toBe(5);
  });

  it("flags 'codigo QR'", () => {
    const signal = detectQrBait("mira este codigo QR");
    expect(signal.present).toBe(true);
    expect(signal.key).toBe("qr-bait-qr-code");
    expect(signal.detail).toBe("codigo qr");
  });

  it("is accent-insensitive", () => {
    expect(detectQrBait("escánea el QR").present).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(detectQrBait("ESCANEA EL QR").present).toBe(true);
  });

  it("picks the earliest phrase by position", () => {
    // "escanea para" (index earlier) vs "qr de pago" (later)
    const signal = detectQrBait("escanea para ver el qr de pago");
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("escanea para");
  });

  it("returns a not-present signal for neutral text", () => {
    const signal = detectQrBait("buenos dias a todos");
    expect(signal.present).toBe(false);
    expect(signal.key).toBe(QR_BAIT_NONE_KEY);
    expect(signal.weight).toBe(0);
    expect(signal.detail).toBeUndefined();
  });

  it("returns a not-present signal for empty text", () => {
    const signal = detectQrBait("   ");
    expect(signal.present).toBe(false);
    expect(signal.key).toBe(QR_BAIT_NONE_KEY);
  });

  it("does not flag the bare word 'escanea' without a QR context", () => {
    expect(detectQrBait("escanea tu documento").present).toBe(false);
  });

  it("is deterministic for identical inputs", () => {
    const input = "escanea el qr de pago";
    expect(detectQrBait(input)).toEqual(detectQrBait(input));
  });

  it("never sets detail when not present", () => {
    expect("detail" in detectQrBait("hola")).toBe(false);
  });
});
