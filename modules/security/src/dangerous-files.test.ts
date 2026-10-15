import { describe, expect, it } from "vitest";
import {
  classifyAttachment,
  DANGEROUS_EXTENSIONS,
  hasDoubleExtension,
  isDangerousFilename,
} from "./dangerous-files.js";

describe("DANGEROUS_EXTENSIONS", () => {
  it("contains the expected executable and script extensions", () => {
    expect(DANGEROUS_EXTENSIONS).toEqual([
      "apk",
      "exe",
      "bat",
      "scr",
      "js",
      "vbs",
      "ps1",
      "jar",
      "msi",
      "com",
    ]);
  });

  it("has no duplicates", () => {
    expect(new Set(DANGEROUS_EXTENSIONS).size).toBe(
      DANGEROUS_EXTENSIONS.length,
    );
  });
});

describe("isDangerousFilename", () => {
  it("flags a plain executable extension", () => {
    expect(isDangerousFilename("setup.exe")).toBe(true);
    expect(isDangerousFilename("app.apk")).toBe(true);
    expect(isDangerousFilename("run.bat")).toBe(true);
  });

  it("is case-insensitive on the extension", () => {
    expect(isDangerousFilename("SETUP.EXE")).toBe(true);
    expect(isDangerousFilename("Photo.ScR")).toBe(true);
  });

  it("tolerates surrounding whitespace", () => {
    expect(isDangerousFilename("  virus.exe  ")).toBe(true);
  });

  it("does not flag safe extensions", () => {
    expect(isDangerousFilename("factura.pdf")).toBe(false);
    expect(isDangerousFilename("foto.jpg")).toBe(false);
    expect(isDangerousFilename("nota.txt")).toBe(false);
  });

  it("returns false for names without an extension", () => {
    expect(isDangerousFilename("README")).toBe(false);
    expect(isDangerousFilename("archivo")).toBe(false);
  });

  it("returns false for empty or dot-only names", () => {
    expect(isDangerousFilename("")).toBe(false);
    expect(isDangerousFilename("   ")).toBe(false);
    expect(isDangerousFilename("...")).toBe(false);
    expect(isDangerousFilename(".exe")).toBe(false);
  });

  it("uses only the final extension", () => {
    expect(isDangerousFilename("archivo.exe.pdf")).toBe(false);
    expect(isDangerousFilename("archivo.pdf.exe")).toBe(true);
  });
});

describe("hasDoubleExtension", () => {
  it("detects a disguised executable", () => {
    expect(hasDoubleExtension("factura.pdf.exe")).toBe(true);
    expect(hasDoubleExtension("foto.jpg.scr")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(hasDoubleExtension("Factura.PDF.EXE")).toBe(true);
  });

  it("returns false for a single extension", () => {
    expect(hasDoubleExtension("factura.pdf")).toBe(false);
    expect(hasDoubleExtension("setup.exe")).toBe(false);
  });

  it("returns false when both extensions are identical", () => {
    expect(hasDoubleExtension("backup.tar.tar")).toBe(false);
  });

  it("returns false for names without extensions", () => {
    expect(hasDoubleExtension("README")).toBe(false);
    expect(hasDoubleExtension("")).toBe(false);
    expect(hasDoubleExtension("   ")).toBe(false);
  });

  it("ignores empty segments from repeated dots", () => {
    expect(hasDoubleExtension("factura..exe")).toBe(false);
    expect(hasDoubleExtension("a.b.c")).toBe(true);
  });
});

describe("classifyAttachment", () => {
  it("marks a double-extension executable with a specific reason", () => {
    expect(classifyAttachment("factura.pdf.exe")).toEqual({
      dangerous: true,
      reason: "Doble extension que oculta un ejecutable .exe",
    });
  });

  it("marks a plain dangerous extension", () => {
    expect(classifyAttachment("setup.exe")).toEqual({
      dangerous: true,
      reason: "Extension peligrosa .exe",
    });
  });

  it("does not include a reason for safe files", () => {
    const verdict = classifyAttachment("factura.pdf");
    expect(verdict).toEqual({ dangerous: false });
    expect(verdict.reason).toBeUndefined();
  });

  it("treats a double extension with a safe final part as safe", () => {
    expect(classifyAttachment("archivo.exe.pdf")).toEqual({ dangerous: false });
  });

  it("treats empty or whitespace names as safe", () => {
    expect(classifyAttachment("")).toEqual({ dangerous: false });
    expect(classifyAttachment("   ")).toEqual({ dangerous: false });
  });

  it("is case-insensitive", () => {
    expect(classifyAttachment("VIRUS.APK")).toEqual({
      dangerous: true,
      reason: "Extension peligrosa .apk",
    });
  });

  it("is deterministic for identical inputs", () => {
    expect(classifyAttachment("foto.jpg.scr")).toEqual(
      classifyAttachment("foto.jpg.scr"),
    );
  });
});
