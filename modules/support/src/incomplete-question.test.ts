import { describe, expect, it } from "vitest";
import {
  assessQuestionCompleteness,
  QUESTION_HINTS,
} from "./incomplete-question.js";

describe("assessQuestionCompleteness", () => {
  it("marks a detailed question with error and system as complete", () => {
    expect(
      assessQuestionCompleteness(
        "La app versión 2.3 en Android me da un error al iniciar sesión, no carga la pantalla.",
      ),
    ).toEqual({ complete: true, missing: [] });
  });

  it("treats undefined as missing everything in fixed order", () => {
    expect(assessQuestionCompleteness(undefined)).toEqual({
      complete: false,
      missing: [
        QUESTION_HINTS.detail,
        QUESTION_HINTS.error,
        QUESTION_HINTS.context,
      ],
    });
  });

  it("treats a blank string as missing everything", () => {
    expect(assessQuestionCompleteness("   ")).toEqual({
      complete: false,
      missing: [
        QUESTION_HINTS.detail,
        QUESTION_HINTS.error,
        QUESTION_HINTS.context,
      ],
    });
  });

  it("flags a single-word question as missing everything", () => {
    expect(assessQuestionCompleteness("ayuda")).toEqual({
      complete: false,
      missing: [
        QUESTION_HINTS.detail,
        QUESTION_HINTS.error,
        QUESTION_HINTS.context,
      ],
    });
  });

  it("reports only the context hint when detail and error are present", () => {
    expect(
      assessQuestionCompleteness(
        "La aplicación se cierra sola cuando abro el chat y no puedo enviar mensajes.",
      ),
    ).toEqual({ complete: false, missing: [QUESTION_HINTS.context] });
  });

  it("reports only the error hint when detail and context are present", () => {
    expect(
      assessQuestionCompleteness(
        "Uso la versión 3.1 en Android pero la aplicación se comporta raro al abrir el menú principal.",
      ),
    ).toEqual({ complete: false, missing: [QUESTION_HINTS.error] });
  });

  it("orders error before context when both are missing", () => {
    expect(
      assessQuestionCompleteness(
        "Hola equipo, buenos días, tengo una pequeña duda sobre algo del grupo hoy.",
      ),
    ).toEqual({
      complete: false,
      missing: [QUESTION_HINTS.error, QUESTION_HINTS.context],
    });
  });

  it("keeps detail before context and skips the satisfied error slot", () => {
    expect(assessQuestionCompleteness("Da error.")).toEqual({
      complete: false,
      missing: [QUESTION_HINTS.detail, QUESTION_HINTS.context],
    });
  });

  it("detects a bare version number as valid context", () => {
    expect(
      assessQuestionCompleteness(
        "Tengo la 2.3 instalada y la aplicación no funciona al abrir el chat.",
      ),
    ).toEqual({ complete: true, missing: [] });
  });

  it("is deterministic for repeated calls with the same input", () => {
    const text =
      "Hola equipo, buenos días, tengo una pequeña duda sobre algo del grupo hoy.";
    expect(assessQuestionCompleteness(text)).toEqual(
      assessQuestionCompleteness(text),
    );
  });

  it("exposes accented, well-punctuated Spanish hints", () => {
    expect(QUESTION_HINTS.detail).toContain("más");
    expect(QUESTION_HINTS.error.startsWith("¿")).toBe(true);
    expect(QUESTION_HINTS.context).toContain("versión");
  });
});
