import { GuardianVerifyClient } from "./verify-client";

// Rendered per request: this page's whole job on the server is to record that
// it was served, which a cached response would silently stop doing.
export const dynamic = "force-dynamic";

/**
 * Server shell for the verification screen.
 *
 * It exists for one reason: to say "this page was served" BEFORE any client
 * JavaScript runs. `progressStep` already records "the Mini App talked to the
 * API", but a session stuck at step 0 could mean two opposite things — nobody
 * tapped the button, or somebody tapped it and the page never finished
 * loading. Those need completely different fixes, and on 2 Aug 2026 that was
 * 15 of 52 sessions with no way to tell them apart.
 *
 * A client-side ping could never answer it: the failure being measured is
 * precisely "the client never ran".
 */
export default async function GuardianVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session } = await searchParams;
  await recordPageView(session);
  return (
    <>
      <SinJavaScript />
      <GuardianVerifyClient />
    </>
  );
}

/**
 * Lo único que ve quien no consigue ejecutar la app.
 *
 * Medido el 8 ago 2026: 18 sesiones de 11 personas con la página SERVIDA y cero
 * peticiones a la API — el JS no arrancó ni una vez. Como esta pantalla no
 * renderiza nada en servidor, lo que veían era un esqueleto de carga
 * indefinidamente: sin mensaje, sin error y sin forma de contárselo a nadie.
 * Uno de ellos lo intentó dos veces de madrugada y se rindió.
 *
 * Va renderizado en SERVIDOR y se borra desde el cliente al montar, asi que
 * sobrevive exactamente a los fallos que hay que cubrir: bundle que no baja,
 * sintaxis que un navegador viejo no parsea, hidratación que revienta. Lo que
 * no puede hacer es avisarnos a nosotros — para eso haría falta que corriera
 * algo, y ese es justo el supuesto que aquí no se cumple.
 *
 * Estilos EN LÍNEA a propósito: si lo que ha fallado es la descarga de recursos,
 * una hoja de estilos externa habría fallado igual.
 */
function SinJavaScript() {
  return (
    <div
      id="guardian-sin-js"
      style={{
        padding: "24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        lineHeight: 1.5,
        color: "var(--tg-theme-text-color, #000)",
      }}
    >
      <p style={{ fontSize: "17px", fontWeight: 600, margin: "0 0 12px" }}>
        📷 La verificación no ha podido abrirse
      </p>
      <p style={{ margin: "0 0 12px" }}>
        No es culpa tuya: tu Telegram no ha conseguido cargar esta pantalla.
      </p>
      <p style={{ margin: "0 0 12px" }}>
        Casi siempre se arregla <strong>actualizando Telegram</strong> a la
        última versión y volviendo a pulsar el botón. Si usas Telegram X o una
        versión modificada, prueba con la oficial.
      </p>
      <p style={{ margin: 0 }}>
        Si aun así sigues viendo esto,{" "}
        <strong>díselo a un admin del grupo</strong> — es un fallo nuestro y lo
        podemos mirar.
      </p>
    </div>
  );
}

/**
 * Fire-and-forget, and bounded. Telemetry must never be a reason a person
 * cannot verify, so every failure path here ends in silence: a missing api
 * URL, a slow api, a rejected request — the page still renders.
 */
async function recordPageView(session: string | undefined): Promise<void> {
  const base = process.env.API_INTERNAL_URL;
  if (!session || !base) {
    return;
  }
  try {
    await fetch(
      new URL("v1/guardian/page-view", base.endsWith("/") ? base : `${base}/`),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session }),
        signal: AbortSignal.timeout(2_000),
      },
    );
  } catch {
    // Silence on purpose — see above.
  }
}
