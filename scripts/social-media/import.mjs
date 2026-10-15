/**
 * Importa recursos a la biblioteca social desde un MANIFIESTO LOCAL.
 *
 * Es la única puerta de entrada. No hay comando, endpoint ni campo de la Mini
 * App que meta una imagen: hay que escribir una entrada en el manifiesto y
 * poner el fichero al lado, en un commit que alguien revisa. Mientras eso sea
 * así, no existe SSRF que discutir — no hay petición saliente que envenenar.
 *
 * Uso:
 *   DATABASE_URL=postgresql://... node scripts/social-media/import.mjs \
 *     [--manifest docs/social-core/media/manifest.json] [--dry-run]
 *
 * El manifiesto es un JSON:
 *   [
 *     { "file": "gato-01.jpg", "kind": "cat",
 *       "source": "fotografía propia, 2026", "licence": "CC0-1.0",
 *       "attribution": null }
 *   ]
 *
 * Los ficheros se buscan JUNTO al manifiesto. El script no sigue rutas
 * absolutas ni relativas hacia arriba: el validador rechaza cualquier nombre
 * que no sea un fichero suelto.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  describeRejection,
  validateManifestEntry,
} from "../../modules/social/src/media-manifest.js";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const DRY_RUN = args.includes("--dry-run");
const MANIFEST = resolve(
  flag("--manifest", "docs/social-core/media/manifest.json"),
);

const client = new PrismaClient();

const main = async () => {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch (error) {
    console.error(`No he podido leer el manifiesto ${MANIFEST}: ${error}`);
    process.exit(2);
  }
  if (!Array.isArray(manifest)) {
    console.error("El manifiesto debe ser una lista de entradas.");
    process.exit(2);
  }

  const base = dirname(MANIFEST);
  let imported = 0;
  let duplicated = 0;
  let rejected = 0;

  for (const entry of manifest) {
    const label = String(entry?.file ?? "(sin nombre)");
    let bytes;
    try {
      // `join` con un nombre ya validado: el validador corre ANTES de tocar el
      // disco para lo que puede decidir sin bytes, y el nombre es lo primero
      // que mira.
      const preflight = validateManifestEntry(entry, new Uint8Array(1024));
      if (!preflight.ok && preflight.reason !== "unknown-format") {
        console.log(
          `RECHAZADO  ${label} — ${describeRejection(preflight.reason)}`,
        );
        rejected += 1;
        continue;
      }
      bytes = new Uint8Array(readFileSync(join(base, entry.file)));
    } catch (error) {
      console.log(`RECHAZADO  ${label} — no se puede leer: ${error}`);
      rejected += 1;
      continue;
    }

    const verdict = validateManifestEntry(entry, bytes);
    if (!verdict.ok) {
      console.log(`RECHAZADO  ${label} — ${describeRejection(verdict.reason)}`);
      rejected += 1;
      continue;
    }

    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const existing = await client.funMediaAsset.findUnique({
      where: { kind_contentHash: { kind: verdict.kind, contentHash } },
    });
    if (existing) {
      console.log(`YA ESTABA  ${label} (${contentHash.slice(0, 12)}…)`);
      duplicated += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`IMPORTARÍA ${label} — ${verdict.mime}, ${verdict.bytes} B`);
      imported += 1;
      continue;
    }

    await client.funMediaAsset.create({
      data: {
        kind: verdict.kind,
        source: entry.source.trim(),
        licence: entry.licence.trim(),
        attribution: entry.attribution ?? null,
        // La ruta relativa al manifiesto, para que el sincronizador sepa qué
        // subir. Nunca una URL: el validador ya lo ha impedido.
        storageKey: entry.file,
        contentHash,
        // Entra como pendiente de revisión. Aprobar es un acto explícito.
        safetyStatus: "pending",
        active: true,
      },
    });
    console.log(`IMPORTADO  ${label} — ${verdict.mime}, ${verdict.bytes} B`);
    imported += 1;
  }

  console.log(
    `\nimportados=${imported} duplicados=${duplicated} rechazados=${rejected}` +
      (DRY_RUN ? "  (simulación, no se ha escrito nada)" : ""),
  );
  console.log(
    "Los recursos entran como 'pending'. Apruébalos antes de que se sirvan:\n" +
      "  UPDATE fun_media_assets SET \"safetyStatus\"='approved' WHERE id = '...';",
  );
  await client.$disconnect();
  process.exit(rejected > 0 ? 1 : 0);
};

main().catch(async (error) => {
  console.error(error);
  await client.$disconnect();
  process.exit(1);
});
