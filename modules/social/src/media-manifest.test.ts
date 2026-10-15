import { describe, expect, it } from "vitest";
import {
  describeRejection,
  MAX_MEDIA_BYTES,
  MAX_UPLOAD_ATTEMPTS,
  type ManifestEntry,
  nextUploadState,
  sniffImageMime,
  validateManifestEntry,
} from "./media-manifest.js";

/**
 * Esta es la única puerta por la que entra una imagen a la biblioteca, así que
 * lo que se prueba aquí es sobre todo lo que NO debe pasar.
 */

/** Cabeceras reales, rellenadas hasta un tamaño creíble. */
const withHeader = (header: number[], size = 4096): Uint8Array => {
  const bytes = new Uint8Array(size);
  bytes.set(header, 0);
  return bytes;
};
const JPEG = () => withHeader([0xff, 0xd8, 0xff, 0xe0]);
const PNG = () => withHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = () => {
  const bytes = withHeader([0x52, 0x49, 0x46, 0x46]);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  return bytes;
};

const entry = (over: Partial<ManifestEntry> = {}): ManifestEntry => ({
  file: "gato-01.jpg",
  kind: "cat",
  source: "fotografía propia, 2026",
  licence: "CC0-1.0",
  ...over,
});

describe("sniffImageMime", () => {
  it("reconoce los tres formatos por su cabecera", () => {
    expect(sniffImageMime(JPEG())).toBe("image/jpeg");
    expect(sniffImageMime(PNG())).toBe("image/png");
    expect(sniffImageMime(WEBP())).toBe("image/webp");
  });

  it("no se cree la extensión: mira los bytes", () => {
    // Un fichero que dice .jpg pero empieza por "<?php" no es una foto.
    const php = new TextEncoder().encode("<?php system($_GET['c']); ?>");
    expect(sniffImageMime(php)).toBeNull();
  });

  it("devuelve null ante un fichero truncado", () => {
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("validateManifestEntry", () => {
  it("acepta una entrada completa y coherente", () => {
    expect(validateManifestEntry(entry(), JPEG())).toEqual({
      ok: true,
      kind: "cat",
      mime: "image/jpeg",
      bytes: 4096,
    });
  });

  it("RECHAZA cualquier cosa que parezca una URL", () => {
    // El punto entero de la biblioteca: no existe camino de una URL a un envío.
    for (const file of [
      "https://ejemplo.com/gato.jpg",
      "http://ejemplo.com/gato.jpg",
      "//ejemplo.com/gato.jpg",
      "file:///etc/passwd",
      "data:image/png;base64,AAAA",
    ]) {
      expect(validateManifestEntry(entry({ file }), JPEG())).toEqual({
        ok: false,
        reason: "looks-like-url",
      });
    }
  });

  it("rechaza rutas y travesías de directorio", () => {
    for (const file of [
      "../../etc/passwd",
      "subdir/gato.jpg",
      "C:\\Windows\\gato.jpg",
      "gato .jpg",
    ]) {
      expect(validateManifestEntry(entry({ file }), JPEG()).ok).toBe(false);
    }
  });

  it("exige procedencia y licencia, no solo que existan los campos", () => {
    expect(validateManifestEntry(entry({ source: "   " }), JPEG())).toEqual({
      ok: false,
      reason: "missing-source",
    });
    expect(validateManifestEntry(entry({ licence: "" }), JPEG())).toEqual({
      ok: false,
      reason: "missing-licence",
    });
  });

  it("rechaza un tipo que no sea gato o perro", () => {
    expect(validateManifestEntry(entry({ kind: "dragon" }), JPEG())).toEqual({
      ok: false,
      reason: "unknown-kind",
    });
  });

  it("rechaza lo demasiado pequeño y lo demasiado grande", () => {
    expect(validateManifestEntry(entry(), new Uint8Array(16)).ok).toBe(false);
    const huge = withHeader([0xff, 0xd8, 0xff, 0xe0], MAX_MEDIA_BYTES + 1);
    expect(validateManifestEntry(entry(), huge)).toEqual({
      ok: false,
      reason: "too-large",
    });
  });

  it("rechaza un formato que no reconoce", () => {
    const gif = withHeader([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(validateManifestEntry(entry(), gif)).toEqual({
      ok: false,
      reason: "unknown-format",
    });
  });

  it("rechaza una extensión que no concuerda con el contenido", () => {
    expect(validateManifestEntry(entry({ file: "gato.png" }), JPEG())).toEqual({
      ok: false,
      reason: "mime-mismatch",
    });
  });

  it("acepta las tres extensiones válidas con su contenido correcto", () => {
    expect(validateManifestEntry(entry({ file: "a.jpeg" }), JPEG()).ok).toBe(
      true,
    );
    expect(validateManifestEntry(entry({ file: "a.png" }), PNG()).ok).toBe(
      true,
    );
    expect(validateManifestEntry(entry({ file: "a.webp" }), WEBP()).ok).toBe(
      true,
    );
  });

  it("explica cada rechazo en castellano", () => {
    const reasons = [
      "unknown-kind",
      "missing-source",
      "missing-licence",
      "bad-file-name",
      "looks-like-url",
      "too-small",
      "too-large",
      "unknown-format",
      "mime-mismatch",
    ] as const;
    for (const reason of reasons) {
      expect(describeRejection(reason).length).toBeGreaterThan(10);
    }
  });
});

describe("nextUploadState", () => {
  it("una subida correcta deja el recurso listo", () => {
    expect(nextUploadState(0, "ok")).toEqual({ state: "ready", attempts: 1 });
  });

  it("un fallo aislado NO lo da por perdido", () => {
    // Telegram devuelve 429 y errores transitorios a diario. Rendirse a la
    // primera dejaría a un bot hijo sin biblioteca por un mal minuto.
    expect(nextUploadState(0, "error")).toEqual({
      state: "pending",
      attempts: 1,
    });
    expect(nextUploadState(1, "error")).toEqual({
      state: "pending",
      attempts: 2,
    });
  });

  it("tras agotar los intentos pasa a fallido, que alguien debe mirar", () => {
    expect(nextUploadState(MAX_UPLOAD_ATTEMPTS - 1, "error")).toEqual({
      state: "failed",
      attempts: MAX_UPLOAD_ATTEMPTS,
    });
  });

  it("un acierto tardío rescata un recurso que iba camino de fallar", () => {
    expect(nextUploadState(MAX_UPLOAD_ATTEMPTS - 1, "ok").state).toBe("ready");
  });
});
