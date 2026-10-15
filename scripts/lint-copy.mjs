// Copy lint: fails if known-bad unaccented es-ES forms (or leaked internal
// codes) reappear in the bot's user-facing source. Run in CI to stop
// regressions — the codebase has historically shipped both spellings.
//
//   node scripts/lint-copy.mjs
//
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const files = [
  // El menu de "/" de Telegram: 78 descripciones que lee todo el mundo al
  // escribir una barra. Es el copy mas visible del bot y no pasaba por aqui.
  "apps/bot/src/poller.ts",
  "apps/bot/src/core-handlers.ts",
  "apps/bot/src/bot-update.service.ts",
  // El copy que ya se fue a su modulo. Esta lista es explicita a proposito
  // —nadie quiere linter sobre 1.500 ficheros— pero por eso mismo hay que
  // ampliarla al mover copy: si no, el texto sale del fichero vigilado y deja
  // de pasar por el filtro sin que falle nada. Es justo lo que va a pasar 173
  // veces mientras se extraen los handlers.
  "modules/security/src/bot/handlers/blocklist.ts",
  "modules/security/src/edit-spam.ts",
  "modules/security/src/bot/handlers/edicion.ts",
  "modules/community/src/bot/handlers/horario-estricto.ts",
  "modules/community/src/bot/handlers/informes-de-temas.ts",
  "modules/community/src/bot/handlers/informes-de-actividad.ts",
  "modules/community/src/bot/handlers/informes-de-reglas.ts",
  "modules/community/src/bot/handlers/informes-de-presencia.ts",
  "modules/automation/src/bot/handlers/calculadoras-de-automatizacion.ts",
  "modules/automation/src/bot/handlers/ajustes-guardados.ts",
  "modules/community/src/bot/handlers/calculadora-de-bienvenida.ts",
  "modules/community/src/bot/handlers/calculadoras-de-comunidad.ts",
  "modules/community/src/bot/handlers/calculadoras-de-owner.ts",
  "modules/community/src/bot/handlers/estados.ts",
  "modules/support/src/bot/handlers/informe-de-cliente.ts",
  "modules/support/src/bot/handlers/calculadoras-de-apelacion.ts",
  "modules/support/src/bot/handlers/calculadoras-de-soporte.ts",
  "modules/support/src/bot/handlers/estados.ts",
  "modules/support/src/bot/handlers/cuarentena.ts",
  "modules/support/src/bot/handlers/informes-apelaciones.ts",
  "modules/security/src/bot/handlers/bloqueo-de-contenido.ts",
  "modules/games/src/bot/handlers/calculadoras-de-juego.ts",
  "modules/security/src/bot/handlers/calculadoras-de-moderacion.ts",
  "modules/security/src/bot/handlers/calculadoras-de-sancion.ts",
  "modules/security/src/bot/handlers/estados.ts",
  "modules/security/src/bot/handlers/calculadoras-de-staff.ts",
  "modules/support/src/bot/handlers/calculadoras-de-staff.ts",
  "modules/security/src/bot/handlers/informes-de-patrones.ts",
  "modules/security/src/bot/handlers/fban-protegidos.ts",
  // La negativa que se le da a quien intenta sancionar a un intocable. Es una
  // sola frase, pero la lee un moderador en el momento en que el bot le dice
  // que no, que es cuando peor sienta que ademas este mal escrita.
  "modules/security/src/intocables.ts",
  // Las negativas y los tres avisos de sancionar a un administrador. Se leen en
  // el peor momento —cuando el bot dice que no, o cuando alguien se ha quedado
  // sin cargo— y es justo cuando peor sienta que ademas esten mal escritos.
  "modules/security/src/sanciones-a-admins.ts",
  // Todo el copy de mascotas: la ficha, el corral, lo que se dice al abrir un
  // huevo y las cuatro negativas de dar de comer. Es la feature nueva con mas
  // texto visible del bot, y sale de un fichero solo — que es justo por lo que
  // hay que darlo de alta aqui en el mismo cambio: copy mudado a un modulo y no
  // registrado deja de pasar el filtro sin que falle nada.
  "modules/games/src/pets/bot/mascotas.ts",
  // Los nombres y las descripciones de las especies. No es copy de mensaje,
  // pero lo lee todo el mundo en la ficha y en el corral.
  "modules/games/src/pets/especies.ts",
  "modules/games/src/pets/rasgos.ts",
  // Las explicaciones de los mandos del creador. Salen poco —solo cuando el
  // mando esta mal escrito— pero cuando salen las lee quien manda, y ademas la
  // negativa de un mando es justo el sitio donde hay que decir bien que hacer.
  "modules/games/src/pets/mandos.ts",
  // El copy de la enfermedad grave: la factura, el plazo y el obituario. Es lo
  // que lee alguien a quien le van a vaciar la cartera, asi que no puede estar
  // mal escrito.
  "apps/bot/src/nucleo/mandos-de-mascotas.ts",
  // El copy de `/ayudante`: lo lee el propietario, pero es la misma voz.
  "apps/bot/src/nucleo/mandos-de-ayudante.ts",
  "apps/bot/src/nucleo/vincular-ayudante.ts",
];

// Word-boundary forms that are always wrong in es-ES prose here.
const badWords = [
  "Moderacion",
  "Diversion",
  "diversion",
  "automatizacion",
  "reputacion",
  "Reputacion",
  "seccion",
  "Seccion",
  "federacion",
  "Federacion",
  "Publicacion",
  "publicacion",
  "verificacion",
  "Verificacion",
  "invitacion",
  "proteccion",
  "duracion",
  "sancion",
  "Sancion",
  "activacion",
  "inyeccion",
  "Opcion",
  "opcion",
  "estadisticas",
  "Estadisticas",
  "configuracion",
  "Configuracion",
  "modulo",
  "Modulo",
  "configuralo",
  "Aniadelo",
  "anademe",
  "Anademe",
  "boton",
  "codigo",
  "ultimos",
  "Ultimos",
];
const badPhrases = ["Aun no", "aun no"];
// Internal codes must never be interpolated into a user message.
const codeLeak = /\$\{(permission|decision)\.reason\}/;

let failures = 0;
for (const rel of files) {
  const lines = readFileSync(path.join(repoRoot, rel), "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const w of badWords) {
      if (new RegExp(`\\b${w}\\b`).test(line)) {
        console.error(`${rel}:${i + 1}  bad word "${w}"  ->  ${line.trim()}`);
        failures++;
      }
    }
    for (const p of badPhrases) {
      if (line.includes(p)) {
        console.error(`${rel}:${i + 1}  bad phrase "${p}"  ->  ${line.trim()}`);
        failures++;
      }
    }
    if (codeLeak.test(line)) {
      console.error(`${rel}:${i + 1}  leaks internal code  ->  ${line.trim()}`);
      failures++;
    }
  });
}

if (failures > 0) {
  console.error(`\ncopy lint: ${failures} issue(s) found.`);
  process.exit(1);
}
console.log("copy lint: clean ✓");
