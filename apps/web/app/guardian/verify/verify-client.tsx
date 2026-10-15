"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Field,
  Screen,
  Section,
  SkeletonList,
} from "../../../components/ui";
import {
  ApiError,
  type GuardianSessionView,
  type GuardianStepResult,
  getGuardianVerifySession,
  postGuardianAttemptStart,
  postGuardianAttemptSubmit,
  postGuardianClientEvent,
  postGuardianConsent,
  postGuardianProgress,
} from "../../../lib/api";
import {
  blobToBase64,
  type CameraStreamResult,
  captureBurst,
  openFrontCamera,
} from "../../../lib/guardian-camera";
import { formatearRetencion } from "../../../lib/guardian-retention";
import { haptic, ready } from "../../../lib/telegram";

const CONSENT_VERSION = "guardian-consent-v1";

// Emoji-labelled instruction per gesture the vision AI can be asked to confirm.
// Mirrors modules/guardian/src/challenge.ts PHOTO_GESTURE_ACTIONS.
const GESTURE_LABELS: Record<string, string> = {
  thumbs_up: "👍 pulgar arriba",
  victory: "✌️ señal de victoria",
  open_palm: "✋ palma abierta",
  closed_fist: "✊ puño cerrado",
  show_one_finger: "☝️ un dedo",
  show_two_fingers: "2️⃣ dos dedos",
  show_three_fingers: "3️⃣ tres dedos",
  ok_hand: "👌 señal de OK",
  call_me: "🤙 pulgar y meñique (llámame)",
  crossed_fingers: "🤞 dedos cruzados",
  thumbs_down: "👎 pulgar abajo",
  love_you: "🤟 pulgar, índice y meñique",
  vulcan_salute: "🖖 saludo vulcano",
  pinched_fingers: "🤌 dedos juntos hacia arriba",
  smile: "😊 una sonrisa",
};
const gestureLabelFor = (action: string): string =>
  GESTURE_LABELS[action] ?? action;

type Phase =
  | { status: "loading" }
  | { status: "missing-session" }
  | { status: "expired" }
  | { status: "error"; message: string }
  | { status: "consent"; session: GuardianSessionView }
  | { status: "declare-age"; session: GuardianSessionView }
  | { status: "permission"; session: GuardianSessionView }
  | { status: "guide"; session: GuardianSessionView; stepIndex: number }
  | { status: "capturing"; session: GuardianSessionView }
  | { status: "analyzing" }
  | {
      status: "retry";
      session: GuardianSessionView;
      reasonCode: string;
      attemptsRemaining: number;
    }
  | { status: "approved" }
  | { status: "queued" }
  | { status: "declined" }
  // Volvió a pedir entrar y su sesión vieja quedó reemplazada por la nueva. El
  // enlace que acaba de abrir es el viejo; el bueno lo tiene en el mismo chat.
  | { status: "superseded" }
  | { status: "technical-failure" };

// Todas las formas de abrir esto sin ser una sesión de Telegram válida acaban
// en la misma frase: la persona no tiene que saber si faltaba el hash, el
// usuario o la cabecera entera.
const ABRIR_DESDE_TELEGRAM =
  "Abre este enlace desde Telegram, no desde un navegador normal.";
// Fallos de nuestro lado, no suyos. Se dice así y se ofrece reintentar.
const NO_DISPONIBLE_AHORA =
  "La verificación no está disponible ahora mismo en este grupo. Toca «Reintentar» en un momento.";

const ERROR_LABELS: Record<string, string> = {
  // --- El enlace ---
  "session-not-found": "Este enlace de verificación no es válido.",
  // Solo como último recurso. El 410 de una sesión cerrada trae su `desenlace`
  // (ver pintarDesenlace) y ese es el que decide la pantalla: aprobada, en
  // revisión, rechazada o reemplazada. Esta frase se quedaba con las cuatro a
  // la vez, y le decía "ya se completó o fue cancelada" a gente que ni había
  // completado ni cancelado nada — 25 veces en un solo día.
  "session-not-active": "Esta verificación ya está cerrada.",
  "session-expired":
    "Esta verificación ha caducado. Vuelve a solicitar entrar al grupo.",
  "session-user-mismatch":
    "Esta verificación pertenece a otra cuenta de Telegram distinta a la que tienes abierta.",
  "missing-session-token":
    "Este enlace está incompleto. Vuelve a abrir el botón de verificación que te envió el bot.",

  // --- Abierto fuera de Telegram, o con un initData que no vale ---
  "no-initdata": ABRIR_DESDE_TELEGRAM,
  "missing-auth": ABRIR_DESDE_TELEGRAM,
  "missing-hash": ABRIR_DESDE_TELEGRAM,
  "invalid-hash": ABRIR_DESDE_TELEGRAM,
  "missing-user": ABRIR_DESDE_TELEGRAM,
  "invalid-user": ABRIR_DESDE_TELEGRAM,
  "missing-auth-date": ABRIR_DESDE_TELEGRAM,
  "auth-date-expired":
    "Tu sesión de Telegram ha caducado. Cierra esta ventana y vuelve a abrir el botón.",

  // --- Nuestro lado ---
  "settings-unavailable": NO_DISPONIBLE_AHORA,
  "bot-token-unavailable": NO_DISPONIBLE_AHORA,
  "rate-limited": "Vas demasiado rápido. Espera unos segundos y reinténtalo.",

  // --- Durante la captura ---
  "no-attempts-left":
    "Has agotado los intentos de esta verificación. El equipo del grupo puede darte uno nuevo.",
  conflict: "Se ha solapado otro intento. Toca «Reintentar».",
  "second-photo-required": "Faltaba la segunda foto. Toca «Reintentar».",
  "invalid-declared-age": "La edad que has escrito no es válida.",
  "invalid-body": "No se pudo procesar el envío. Toca «Reintentar».",
  "missing-version":
    "No se pudo registrar tu consentimiento. Toca «Reintentar».",

  // The two ways a request can fail to answer at all. Before these existed the
  // screen simply stayed on "Cargando…" forever, which read as a broken app and
  // left no trace on the server to explain it.
  "request-timeout":
    "El servidor ha tardado demasiado en responder. Toca «Reintentar»; si vuelve a pasar, prueba con otra conexión (datos móviles o wifi).",
  "network-unreachable":
    "No he podido conectar. Comprueba tu conexión y toca «Reintentar».",
  "upstream-timeout":
    "El servidor ha tardado demasiado en responder. Toca «Reintentar».",
};

/**
 * Lo que no esté en el mapa cae en una frase, no en el código crudo.
 *
 * Antes el `?? message` enseñaba el código tal cual: `settings-unavailable`,
 * `rate-limited`, `missing-session-token` y —para cualquier fallo que no
 * viniera del servidor— literalmente la palabra `unknown`. Inglés técnico en
 * una pantalla roja, a alguien que solo quería entrar en un grupo.
 *
 * No se pierde nada por diagnosticar: desde ahora el guard registra CADA uno
 * de sus once rechazos en el servidor (ver guardian-session.guard.ts), que es
 * donde el código sirve para algo y donde no asusta a nadie.
 */
const humanError = (message: string): string =>
  ERROR_LABELS[message] ??
  "Algo ha fallado y no hemos podido continuar. Toca «Reintentar»; si vuelve a pasar, prueba con otra conexión.";

function GuardianVerifyInner() {
  const search = useSearchParams();
  const [phase, setPhase] = useState<Phase>({ status: "loading" });
  // Self-declared age, entered before the photo. Held across the phase
  // transitions so captureAndSubmit can include it in the submit body. It is
  // STAFF-facing only — the server never uses it as an approve/decline signal.
  const [ageInput, setAgeInput] = useState("");
  const [declaredAge, setDeclaredAge] = useState<number | null>(null);
  // Double verification (2 photos): the attempt is opened once, on the FIRST
  // gesture, and the first photo is held here while the Mini App re-guides
  // the person through the second (different) gesture before a single
  // combined submit — never two separate attempt/submit calls.
  const [pendingAttemptId, setPendingAttemptId] = useState<string | null>(null);
  const [firstPhotoBase64, setFirstPhotoBase64] = useState<string | null>(null);
  const sessionToken = search.get("session") ?? "";

  // Borra el aviso renderizado en servidor (SinJavaScript, en page.tsx). Si
  // este efecto llega a correr es que el cliente SÍ ha arrancado, y a partir de
  // ese instante ese texto miente. Quien no lo vea desaparecer es exactamente
  // la persona a la que va dirigido.
  useEffect(() => {
    document.getElementById("guardian-sin-js")?.remove();
  }, []);

  // Errores del navegador. Sin esto, alguien que se queda entre la primera foto
  // y la segunda no deja NADA: el servidor no vuelve a saber de él hasta el
  // envío, y el seguimiento de errores es solo de servidor a propósito (ver
  // apps/web/instrumentation.ts). Son 23 intentos perdidos en 30 días, en los
  // dos grupos, de los que hoy no se puede decir ni dónde murieron.
  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    const onError = (e: ErrorEvent) => {
      postGuardianClientEvent(
        sessionToken,
        "window.error",
        `${e.message} @ ${e.filename}:${e.lineno}`,
      );
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r: unknown = e.reason;
      postGuardianClientEvent(
        sessionToken,
        "unhandled.rejection",
        r instanceof Error ? r.message : String(r),
      );
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [sessionToken]);
  const cameraRef = useRef<CameraStreamResult | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && cameraRef.current) {
      el.srcObject = cameraRef.current.stream;
    }
  };

  /**
   * Una sesión cerrada que YA trae su desenlace no es un fallo que enseñar en
   * rojo: es el estado real de una verificación que terminó. Devuelve true si
   * ha pintado la pantalla, para que quien llame no siga hasta el error.
   *
   * La miga que se manda es `verify.desenlace`, NO `verify.error`: volver a
   * mirar cómo va lo tuyo es de lo más normal, y contarlo como error deja la
   * misma métrica envenenada que hizo falta desenredar para encontrar esto.
   */
  const pintarDesenlace = useCallback(
    (desenlace: string | undefined): boolean => {
      const pantalla: Record<string, Phase> = {
        aprobada: { status: "approved" },
        "en-revision": { status: "queued" },
        rechazada: { status: "declined" },
        reemplazada: { status: "superseded" },
      };
      const fase = desenlace ? pantalla[desenlace] : undefined;
      if (!fase) {
        return false;
      }
      postGuardianClientEvent(sessionToken, "verify.desenlace", desenlace);
      setPhase(fase);
      return true;
    },
    [sessionToken],
  );

  /**
   * Una pantalla roja que además deja rastro en el servidor.
   *
   * La lección del 2026-08-10: la Mini App enseñó "esta verificación ya se
   * completó o fue cancelada" en dos grupos mientras la API llevaba 2 h 45 min
   * sin responder un solo 410. La respuesta salía de la caché del propio
   * webview, así que la petición no llegaba a salir del móvil y el servidor no
   * tenía forma de enterarse: en sus registros, esas personas eran
   * indistinguibles de las que no tocaron nada. Ninguna pantalla de error puede
   * volver a ser invisible desde fuera.
   *
   * La miga sale por `sendBeacon`, que es un POST: nadie la puede contestar
   * desde una caché. Sobrevive exactamente al fallo que existe para contar.
   *
   * `mensaje` solo para los errores que no son un código del servidor (la
   * cámara): el código viaja igual, y es por lo que se puede agrupar después.
   *
   * `causa` es el error tal cual, no su mensaje: es lo único que trae el
   * desenlace de una sesión que se cerró mientras la persona estaba dentro.
   */
  const fallar = useCallback(
    (codigo: string, mensaje?: string, causa?: unknown) => {
      // Se mira ANTES de dar nada por roto: cualquier llamada puede toparse con
      // una sesión que se cerró mientras la persona miraba la pantalla, y todas
      // acaban aquí.
      if (causa instanceof ApiError && pintarDesenlace(causa.desenlace)) {
        return;
      }
      postGuardianClientEvent(sessionToken, "verify.error", codigo);
      setPhase({ status: "error", message: mensaje ?? humanError(codigo) });
    },
    [sessionToken, pintarDesenlace],
  );

  const loadSession = useCallback(() => {
    if (!sessionToken) {
      setPhase({ status: "missing-session" });
      return;
    }
    setPhase({ status: "loading" });
    getGuardianVerifySession(sessionToken)
      .then((session) => setPhase({ status: "consent", session }))
      .catch((e: unknown) => {
        // El guard tiene DOS 410 y no significan lo mismo: `session-expired`
        // (el plazo se la llevó) y `session-not-active` (ya estaba resuelta o
        // cancelada). Mirar el status los juntaba a los dos en la pantalla de
        // caducado, y con ella el consejo de "vuelve a solicitar entrar", que
        // para una sesión ya cerrada no arregla nada.
        //
        // No es un matiz teórico. En 48 h se sirvió la pantalla de caducado 7
        // veces y NINGUNA de las 7 había caducado: las 7 eran sesiones
        // cerradas. Y la etiqueta de `session-not-active`, escrita desde el
        // primer día, era inalcanzable porque este `if` la interceptaba antes.
        //
        // Que además casi nunca pueda ser caducidad lo dice el propio embudo:
        // quien abre el enlace lo abre en 2 s de mediana (7 s en el p90), y de
        // 674 aperturas en una semana solo UNA pasó de los 10 min de plazo.
        //
        // Cuidado con ese "casi nunca": está medido con el guard sellando como
        // `cerrada` toda sesión que el barrido del worker ya había marcado
        // `expired`, o sea con la mayoría de las caducidades contadas en el otro
        // montón. Desde el 2026-08-10 el guard separa las dos de verdad (ver
        // guardian-session.guard.ts), así que esta pantalla va a aparecer más de
        // lo que dice el párrafo de arriba — y cuando aparezca, será cierta.
        if (e instanceof ApiError && e.message === "session-expired") {
          postGuardianClientEvent(
            sessionToken,
            "verify.error",
            "session-expired",
          );
          setPhase({ status: "expired" });
          return;
        }
        fallar(e instanceof ApiError ? e.message : "unknown", undefined, e);
      });
  }, [sessionToken, fallar]);

  useEffect(() => {
    ready();
    loadSession();

    return () => {
      cameraRef.current?.release();
    };
  }, [loadSession]);

  const releaseCamera = () => {
    cameraRef.current?.release();
    cameraRef.current = null;
  };

  const acceptConsent = async (session: GuardianSessionView) => {
    try {
      await postGuardianConsent(sessionToken, CONSENT_VERSION);
      haptic.notify("success");
      setPhase({ status: "declare-age", session });
    } catch (e) {
      fallar((e as Error).message, undefined, e);
    }
  };

  // The user declares their age BEFORE the camera opens. We only advance once
  // it's a sane integer; the STAFF report shows this next to the AI estimate.
  const parsedAge = Number.parseInt(ageInput, 10);
  const ageValid =
    Number.isInteger(parsedAge) && parsedAge >= 1 && parsedAge <= 120;
  const submitAge = (session: GuardianSessionView) => {
    if (!ageValid) {
      return;
    }
    setDeclaredAge(parsedAge);
    haptic.selection();
    // Fire-and-forget telemetry: reaching the camera screen involves no other
    // server call, so without this the funnel cannot tell a refused camera
    // apart from an age screen nobody filled in. Never awaited — a failed ping
    // must not stand between someone and their verification.
    void postGuardianProgress(sessionToken, "age").catch(() => {});
    setPhase({ status: "permission", session });
  };

  const requestCamera = async (session: GuardianSessionView) => {
    try {
      const camera = await openFrontCamera();
      cameraRef.current = camera;
      // The camera actually opened — the step most likely to lose people.
      void postGuardianProgress(sessionToken, "camera").catch(() => {});
      setPhase({ status: "guide", session, stepIndex: 0 });
    } catch {
      fallar(
        "camera-unavailable",
        "No pude acceder a tu cámara. Revisa los permisos de cámara de Telegram/tu navegador e inténtalo de nuevo.",
      );
    }
  };

  // Session-wide clock for the whole attempt (both photos, when there are
  // two) — steps are timed relative to when the FIRST gesture's capture
  // began, matching how the server verifies step order/timing as one
  // continuous sequence (see verifyChallengeSubmission).
  const sessionStartedAtMsRef = useRef(0);

  // Takes ONE still photo for the gesture at `stepIndex`. With a single-photo
  // challenge this both captures and submits immediately. With double
  // verification (2 steps), the FIRST photo is held in state and the Mini App
  // re-guides the person through the SECOND (different) gesture before a
  // single combined submit — the gesture itself, "is this a real live
  // person", the age estimate, and (with 2 photos) whether both show the same
  // person are all judged server-side; the client never self-reports a
  // passing result.
  const captureAndSubmit = async (
    session: GuardianSessionView,
    stepIndex: number,
  ) => {
    const camera = cameraRef.current;
    const video = videoRef.current;
    if (!camera || !video) {
      setPhase({ status: "permission", session });
      return;
    }
    const gestureAction = session.challenge.steps[stepIndex]?.action ?? "";
    const isFirstStep = stepIndex === 0;
    const isLastStep = stepIndex === session.challenge.steps.length - 1;

    let attemptId = pendingAttemptId;
    if (isFirstStep) {
      const startResult = await postGuardianAttemptStart(sessionToken).catch(
        // El error se guarda entero, no solo su mensaje: si la sesión se cerró
        // mientras tanto, el desenlace viaja dentro y `fallar` lo pinta.
        (e: Error) => ({ error: e.message, causa: e }),
      );
      if ("error" in startResult) {
        fallar(startResult.error, undefined, startResult.causa);
        return;
      }
      attemptId = startResult.attemptId;
      setPendingAttemptId(attemptId);
      sessionStartedAtMsRef.current = Date.now();
    }
    if (!attemptId) {
      setPhase({ status: "technical-failure" });
      releaseCamera();
      return;
    }

    // La captura va ANTES de cambiar de pantalla, no después. La pantalla de
    // "Tomando la foto…" no lleva <video>, así que ponerla primero desmontaba
    // justo el elemento del que se está a punto de dibujar, y se capturaba de
    // un vídeo ya desprendido del DOM. Cambiar de fase después no cuesta nada
    // —la captura es un dibujo en canvas— y quita esa carrera de en medio.
    // Duele más en la SEGUNDA foto, donde el <video> acaba de remontarse y de
    // reengancharse el stream.
    let mediaBase64: string;
    try {
      const frames = await captureBurst(video, 1, 0);
      const frame = frames[0];
      if (!frame) {
        throw new Error("no-frame-captured");
      }
      setPhase({ status: "capturing", session });
      mediaBase64 = await blobToBase64(frame.blob);
    } catch (e) {
      postGuardianClientEvent(
        sessionToken,
        `capture.failed.paso${stepIndex + 1}`,
        e instanceof Error ? e.message : String(e),
      );
      setPhase({ status: "technical-failure" });
      releaseCamera();
      return;
    }

    if (!isLastStep) {
      // More gestures to go (double verification's second photo) — hold this
      // photo and re-guide for the next step instead of submitting yet.
      //
      // La miga sale AQUI, no al enviar: este es el punto exacto donde se
      // pierde gente sin dejar rastro. Con ella registrada, quien desaparezca
      // murió en el segundo gesto; sin ella, no llegó ni a la primera foto.
      postGuardianClientEvent(sessionToken, "foto1.capturada");
      setFirstPhotoBase64(mediaBase64);
      setPhase({ status: "guide", session, stepIndex: stepIndex + 1 });
      return;
    }

    setPhase({ status: "analyzing" });
    const stepResults: GuardianStepResult[] = session.challenge.steps.map(
      (step, i) => ({
        action: i === stepIndex ? gestureAction : step.action,
        detectedAt: Date.now(),
      }),
    );

    try {
      const result = await postGuardianAttemptSubmit(sessionToken, {
        attemptId,
        mediaBase64: firstPhotoBase64 ?? mediaBase64,
        declaredMimeType: "image/jpeg",
        challengeNonce: session.challenge.nonce,
        stepResults,
        sessionStartedAtMs: sessionStartedAtMsRef.current,
        ...(declaredAge !== null ? { declaredAge } : {}),
        ...(firstPhotoBase64
          ? {
              secondMediaBase64: mediaBase64,
              secondDeclaredMimeType: "image/jpeg",
            }
          : {}),
      });

      if (result.outcome === "retry") {
        haptic.notify("warning");
        setPhase({
          status: "retry",
          session,
          reasonCode: result.reasonCode,
          attemptsRemaining: result.attemptsRemaining,
        });
        return;
      }

      releaseCamera();
      // El servidor decidió pero no pudo guardarlo. Decirle "listo" a esta
      // persona seria mentirle: su sesión sigue viva y el plazo la matará.
      if (result.outcome === "technical-failure") {
        setPhase({ status: "technical-failure" });
        return;
      }
      if (result.decision === "auto_approve") {
        haptic.notify("success");
        setPhase({ status: "approved" });
      } else if (result.decision === "auto_decline") {
        haptic.notify("error");
        setPhase({ status: "declined" });
      } else if (result.decision === "technical_failure") {
        setPhase({ status: "technical-failure" });
      } else {
        setPhase({ status: "queued" });
      }
    } catch (e) {
      releaseCamera();
      fallar((e as Error).message, undefined, e);
    }
  };

  const retry = (session: GuardianSessionView) => {
    // A retry redoes the WHOLE sequence from the first gesture, not just the
    // last photo — a fresh attempt needs its own attemptId.
    setPendingAttemptId(null);
    setFirstPhotoBase64(null);
    setPhase({ status: "guide", session, stepIndex: 0 });
  };

  if (phase.status === "loading") {
    return (
      <Screen>
        <AppHeader
          glyph="🛡️"
          tone="blue"
          title="Guardian Verification"
          subtitle="Cargando…"
        />
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  if (phase.status === "missing-session") {
    return (
      <Screen>
        <Banner kind="error">
          Falta el enlace de sesión. Abre esta Mini App desde el botón de tu
          solicitud de entrada en Telegram.
        </Banner>
      </Screen>
    );
  }

  if (phase.status === "expired") {
    return (
      <Screen>
        <AppHeader glyph="⌛" tone="orange" title="Verificación caducada" />
        <Banner kind="error">
          Esta verificación ha caducado. Vuelve a solicitar entrar al grupo para
          generar una nueva.
        </Banner>
        {/* La pantalla de error de abajo lleva salida desde el principio, y su
            comentario dice por qué: un callejón sin salida le cuesta el grupo a
            esta persona. Esta pantalla era exactamente ese callejón y era la
            única sin botón — encima aconsejando algo que no se puede hacer,
            porque con `declineOnExpiry` en false la solicitud sigue pendiente
            en Telegram y no se puede volver a pedir entrada.
            Reintentar es un GET y no gasta intento: si el enlace estaba vivo
            (un 410 mal leído, una carga que falló a medias), la verificación
            sigue por donde iba en vez de morir aquí. */}
        <Button onClick={loadSession}>Reintentar</Button>
      </Screen>
    );
  }

  if (phase.status === "error") {
    return (
      <Screen>
        <AppHeader glyph="⚠️" tone="red" title="Guardian Verification" />
        <Banner kind="error">{phase.message}</Banner>
        {/* A dead end costs this person the group. Retrying the session load
            is always safe — it is a plain GET — so the way out is offered for
            every error, not only the ones we recognise. */}
        <Button onClick={loadSession}>Reintentar</Button>
      </Screen>
    );
  }

  if (phase.status === "consent") {
    const retencion = formatearRetencion(phase.session.mediaRetentionHours);
    return (
      <Screen>
        <AppHeader
          glyph="🛡️"
          tone="blue"
          title="Verificación de entrada"
          subtitle="Una foto para comprobar que eres una persona real"
        />
        {/*
          Lo caro va primero. Esta pantalla enumeraba siete cosas que le íbamos
          a hacer a la persona y ninguna de lo que le costaba: cuánto tarda y
          cuándo desaparece su foto estaban en los puestos 5 y 6, en la misma
          voz que el resto. Aquí se pierde 1 de cada 4 de los que abren la Mini
          App (217 de 878), y es el mayor agujero sobre el que mandamos algo:
          el mensaje anterior lo escribe Telegram, este es nuestro.

          El minuto no es un adorno: las verificaciones que aprueba la IA tardan
          43 s de mediana en producción (p90 83 s). Si algún día deja de ser
          verdad, esta frase pasa a ser mentira y hay que cambiarla.
        */}
        <Section caption="Lo que te va a costar">
          <ul className="guardian-consent-list">
            <li>
              <strong>Menos de un minuto.</strong> Una sola foto con la cámara
              frontal, en la que se te vea la cara y un gesto con la mano.
            </li>
            <li>
              <strong>
                {retencion
                  ? `Tu foto se borra sola en ${retencion}.`
                  : "Tu foto se borra sola."}
              </strong>{" "}
              No se usa para entrenar ninguna inteligencia artificial.
            </li>
            <li>
              <strong>La ve el STAFF del grupo</strong>, y nadie más.
            </li>
          </ul>
        </Section>
        <Section caption="Qué pasa después">
          <ul className="guardian-consent-list">
            <li>
              Una IA comprueba que eres una persona real, que haces el gesto
              pedido y estima tu edad.
            </li>
            <li>
              Si el resultado no es concluyente, lo revisa un moderador humano y
              puede tardar un poco más.
            </li>
          </ul>
        </Section>
        <Button
          variant="primary"
          block
          onClick={() => void acceptConsent(phase.session)}
        >
          Entendido, continuar
        </Button>
      </Screen>
    );
  }

  if (phase.status === "declare-age") {
    return (
      <Screen>
        <AppHeader
          glyph="🎂"
          tone="blue"
          title="¿Cuántos años tienes?"
          subtitle="Indícalo antes de tomar la foto"
        />
        <Section caption="Tu edad">
          <Field
            label="Edad"
            hint="Pon tu edad REAL. No hay ningún mínimo que cumplir aquí, y mentir solo perjudica: el equipo compara esta edad con la que la IA estime a partir de tu foto, y que no cuadren es lo que manda tu caso a revisión."
          >
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
              placeholder="Ej: 20"
            />
          </Field>
        </Section>
        <Button
          variant="primary"
          block
          disabled={!ageValid}
          onClick={() => submitAge(phase.session)}
        >
          Continuar
        </Button>
      </Screen>
    );
  }

  if (phase.status === "permission") {
    // El gesto se enseñaba DESPUÉS de conceder la cámara, en la pantalla
    // siguiente. Asi que aqui se le pedia a alguien el permiso mas incomodo de
    // todos sin decirle para que, y 36 personas de 878 se quedaron justo en
    // este paso. El dato viaja en la sesion desde el primer momento: solo no se
    // enseñaba. Verlo antes no cuesta nada y convierte "activar la camara" en
    // una peticion con motivo.
    const primerGesto = phase.session.challenge.steps[0]?.action ?? "";
    return (
      <Screen>
        <AppHeader
          glyph="📷"
          tone="blue"
          title="Activar la cámara"
          subtitle="Solo se usará la cámara frontal"
        />
        {primerGesto ? (
          <Section caption="Esto es lo que te vamos a pedir">
            <p className="guardian-gesture-instruction">
              {gestureLabelFor(primerGesto)}
            </p>
          </Section>
        ) : null}
        <Banner kind="info">
          Al continuar, Telegram te pedirá permiso de cámara. No se accederá a
          tu galería en ningún momento.
        </Banner>
        <Button
          variant="primary"
          block
          onClick={() => void requestCamera(phase.session)}
        >
          Activar cámara
        </Button>
      </Screen>
    );
  }

  if (phase.status === "guide") {
    const totalSteps = phase.session.challenge.steps.length;
    const gesture =
      phase.session.challenge.steps[phase.stepIndex]?.action ?? "";
    const isSecondPhoto = totalSteps > 1 && phase.stepIndex > 0;
    return (
      <Screen>
        <AppHeader
          glyph="🖐️"
          tone="purple"
          title={
            totalSteps > 1
              ? `Foto ${phase.stepIndex + 1} de ${totalSteps}`
              : "Tu foto de verificación"
          }
          subtitle={
            isSecondPhoto
              ? "Ahora una segunda foto, con OTRO gesto, para confirmar que eres tú"
              : "Que se vea tu cara y el gesto, y toma la foto"
          }
        />
        <Section caption="Haz este gesto con la mano">
          <p className="guardian-gesture-instruction">
            {gestureLabelFor(gesture)}
          </p>
        </Section>
        <video
          autoPlay
          muted
          playsInline
          className="guardian-camera-preview"
          ref={attachVideo}
        />
        <Banner kind="info">
          Coloca tu cara y la mano dentro del encuadre, con buena luz, y pulsa
          el botón para tomar la foto.
        </Banner>
        <Button
          variant="primary"
          block
          onClick={() => void captureAndSubmit(phase.session, phase.stepIndex)}
        >
          Tomar foto
        </Button>
      </Screen>
    );
  }

  if (phase.status === "capturing") {
    return (
      <Screen>
        <AppHeader glyph="📸" tone="blue" title="Tomando la foto…" />
        <SkeletonList rows={1} />
      </Screen>
    );
  }

  if (phase.status === "analyzing") {
    return (
      <Screen>
        <AppHeader
          glyph="🔎"
          tone="blue"
          title="Analizando…"
          subtitle="Un momento, por favor"
        />
        <SkeletonList rows={2} />
      </Screen>
    );
  }

  if (phase.status === "retry") {
    return (
      <Screen>
        <AppHeader glyph="🔁" tone="orange" title="Repite la foto" />
        <Banner kind="info">
          {retryReasonLabel(phase.reasonCode)} Te quedan{" "}
          {phase.attemptsRemaining}{" "}
          {phase.attemptsRemaining === 1 ? "intento" : "intentos"}.
        </Banner>
        <Button variant="primary" block onClick={() => retry(phase.session)}>
          Reintentar
        </Button>
      </Screen>
    );
  }

  if (phase.status === "approved") {
    return (
      <Screen>
        <AppHeader
          glyph="✅"
          tone="green"
          title="¡Verificación superada!"
          subtitle="Ya deberías poder entrar al grupo"
        />
        {/* Sin "automáticamente": esta pantalla ya no sale solo al terminar la
            foto, también al volver a abrir el enlace, y entonces el sí puede
            haberlo dado un admin a mano. */}
        <Banner kind="success">Tu solicitud ha sido aprobada.</Banner>
      </Screen>
    );
  }

  if (phase.status === "superseded") {
    return (
      <Screen>
        <AppHeader
          glyph="🔗"
          tone="orange"
          title="Este enlace es el viejo"
          subtitle="Tienes uno más nuevo en el chat"
        />
        <Banner kind="info">
          Volviste a solicitar entrar, así que esta verificación se sustituyó
          por otra. Busca el último mensaje del bot en tu chat y pulsa ese
          botón.
        </Banner>
      </Screen>
    );
  }

  if (phase.status === "queued") {
    return (
      <Screen>
        <AppHeader
          glyph="🕓"
          tone="orange"
          title="En revisión"
          subtitle="Un moderador revisará tu solicitud"
        />
        <Banner kind="info">
          Tu verificación no fue concluyente automáticamente. El equipo del
          grupo la revisará en breve.
        </Banner>
      </Screen>
    );
  }

  if (phase.status === "declined") {
    return (
      <Screen>
        <AppHeader glyph="❌" tone="red" title="Solicitud rechazada" />
        <Banner kind="error">Tu solicitud de entrada ha sido rechazada.</Banner>
      </Screen>
    );
  }

  // technical-failure
  return (
    <Screen>
      <AppHeader glyph="⚠️" tone="red" title="Problema técnico" />
      <Banner kind="error">
        Hubo un problema técnico al procesar tu verificación. Tu solicitud ha
        quedado pendiente de revisión manual — nunca se aprueba automáticamente
        ante un fallo técnico.
      </Banner>
    </Screen>
  );
}

const retryReasonLabel = (reasonCode: string): string => {
  const labels: Record<string, string> = {
    challenge_incomplete: "No se pudo verificar el gesto.",
    no_face_detected: "No se detectó tu cara en la foto.",
    multiple_faces_detected: "Se detectó más de una persona en la foto.",
    capture_quality_too_low:
      "La calidad de la foto fue demasiado baja (revisa la iluminación).",
    unrecognized_format: "No se pudo procesar el formato de la foto.",
    "media-invalid": "La foto no cumple los requisitos (tamaño/resolución).",
    below_minimum_signal: "El gesto no se reconoció con claridad.",
  };
  return labels[reasonCode] ?? "No se pudo verificar tu intento.";
};

export function GuardianVerifyClient() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={3} />
        </Screen>
      }
    >
      <GuardianVerifyInner />
    </Suspense>
  );
}
