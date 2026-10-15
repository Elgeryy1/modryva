/**
 * Reconciles verification_media against what storage actually holds.
 *
 * A relative GUARDIAN_STORAGE_PATH meant captured photos were written beside
 * the volume instead of into it (see commit d42c5fb), so rows survive pointing
 * at objects that a redeploy destroyed. Until those rows are squared up the
 * database claims to hold face photos it does not have -- the wrong direction
 * to be wrong about for a group of minors -- and retention keeps listing them.
 *
 * Checks every row individually rather than trusting the incident's date: any
 * object that IS present is left completely alone.
 */
import {
  PrismaFoundationRepository,
  PrismaGuardianRepository,
  prisma,
} from "@superbot/data";
import { createStorageDriverFromEnv } from "@superbot/module-files";
import { getRuntimeEnv } from "@superbot/shared";

const APPLY = process.argv.includes("--apply");
const storage = createStorageDriverFromEnv(getRuntimeEnv());
const repo = new PrismaGuardianRepository();
const foundation = new PrismaFoundationRepository();

const rows = await prisma.verificationMedia.findMany({
  where: { deletedAt: null },
  select: {
    id: true,
    sessionId: true,
    objectStorageKey: true,
    createdAt: true,
  },
  orderBy: { createdAt: "asc" },
});

const missing: string[] = [];
let present = 0;
for (const row of rows) {
  let exists = false;
  try {
    exists = (await storage.get(row.objectStorageKey)) !== null;
  } catch {
    exists = false;
  }
  if (exists) present += 1;
  else missing.push(row.id);
}

console.log(`filas sin marcar borrar: ${rows.length}`);
console.log(`  objeto PRESENTE: ${present}`);
console.log(`  objeto AUSENTE : ${missing.length}`);

if (!APPLY) {
  console.log("\n(simulacion — nada modificado; usa --apply para aplicar)");
  process.exit(0);
}

for (const id of missing) {
  await repo.markMediaDeleted(id);
}

const tenantId = (
  await prisma.verificationSession.findFirst({ select: { tenantId: true } })
)?.tenantId;
if (tenantId) {
  await foundation.recordAudit({
    tenantId,
    actorType: "system",
    action: "guardian.media.reconciled_lost",
    resourceType: "verification_media",
    resourceId: "bulk",
    payload: {
      lost: missing.length,
      stillPresent: present,
      cause:
        "relative GUARDIAN_STORAGE_PATH wrote media beside the volume; redeploys destroyed it (fixed in d42c5fb)",
    },
  });
}
console.log(
  `\nmarcadas como perdidas: ${missing.length}; intactas: ${present}`,
);
