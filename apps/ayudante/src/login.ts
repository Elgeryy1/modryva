import { createInterface } from "node:readline/promises";
import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

/**
 * Genera la sesión MTProto del Ayudante. **Lo ejecuta una persona, una vez.**
 *
 * Pide teléfono, código y (si la cuenta lo tiene) contraseña de dos pasos, y
 * escupe la cadena de sesión por pantalla. Nada de eso se guarda en ningún
 * sitio: ni en disco, ni en un log, ni en la base de datos. Lo que hagas con
 * la cadena es cosa tuya.
 *
 * Uso, desde la raíz del repo:
 *
 *   node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.base.json \
 *     apps/ayudante/src/login.ts
 *
 * Necesita `AYUDANTE_API_ID` y `AYUDANTE_API_HASH` en el `.env`, que salen de
 * https://my.telegram.org → API development tools.
 *
 * AVISO: la cadena resultante vale tanto como la contraseña de la cuenta —
 * quien la tenga es esa persona en Telegram, sin segundo factor que valga.
 * Nunca en git, nunca en un pantallazo, nunca pegada en un chat.
 */

const main = async (): Promise<void> => {
  const apiId = Number(process.env.AYUDANTE_API_ID);
  const apiHash = process.env.AYUDANTE_API_HASH;

  if (!Number.isInteger(apiId) || apiId <= 0 || !apiHash) {
    console.error(
      "Faltan AYUDANTE_API_ID y/o AYUDANTE_API_HASH en el entorno.\n" +
        "Sácalos de https://my.telegram.org (API development tools) y ponlos\n" +
        "en el .env antes de volver a ejecutar esto.",
    );
    process.exit(1);
  }

  const consola = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const cliente = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  console.log(
    "\nVas a iniciar sesión con la cuenta AYUDANTE.\n" +
      "Usa la cuenta desechable (no la del propietario) salvo que sepas\n" +
      "exactamente por qué necesitas la otra.\n",
  );

  await cliente.start({
    phoneNumber: async () =>
      (await consola.question("Teléfono (con prefijo, ej. +34...): ")).trim(),
    password: async () =>
      (
        await consola.question("Contraseña de dos pasos (vacío si no tiene): ")
      ).trim(),
    phoneCode: async () =>
      (
        await consola.question("Código que te ha llegado por Telegram: ")
      ).trim(),
    onError: (error) => {
      console.error("Error durante el login:", error.message);
    },
  });

  const yo = await cliente.getMe();
  const alias =
    "username" in yo ? (yo.username ?? "(sin alias)") : "(sin alias)";

  console.log(
    `\nSesión abierta como ${alias} (id ${yo.id}).\n\n` +
      "Pega esta línea en el .env como AYUDANTE_SESSION, o guárdala en el\n" +
      "fichero al que apunte AYUDANTE_SESSION_PATH:\n",
  );
  console.log(`AYUDANTE_SESSION=${cliente.session.save()}\n`);
  console.log(
    "Trátala como la contraseña de la cuenta: fuera de git, fuera de los\n" +
      "logs, y fuera de cualquier chat.\n",
  );

  await cliente.destroy();
  consola.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
