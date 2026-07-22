"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
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
  postGuardianConsent,
} from "../../../lib/api";
import {
  blobToBase64,
  type CameraStreamResult,
  captureBurst,
  openFrontCamera,
} from "../../../lib/guardian-camera";
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
  show_two_fingers: "✌️ dos dedos",
  show_three_fingers: "🖐️ tres dedos",
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
  | { status: "technical-failure" };

const ERROR_LABELS: Record<string, string> = {
  "session-not-found": "Este enlace de verificación no es válido.",
  "session-not-active": "Esta verificación ya se completó o fue cancelada.",
  "session-expired":
    "Esta verificación ha caducado. Vuelve a solicitar entrar al grupo.",
  "session-user-mismatch":
    "Esta verificación pertenece a otra cuenta de Telegram distinta a la que tienes abierta.",
  "no-initdata":
    "Abre este enlace desde Telegram, no desde un navegador normal.",
};
const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

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
  const cameraRef = useRef<CameraStreamResult | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && cameraRef.current) {
      el.srcObject = cameraRef.current.stream;
    }
  };

  useEffect(() => {
    ready();
    if (!sessionToken) {
      setPhase({ status: "missing-session" });
      return;
    }
    getGuardianVerifySession(sessionToken)
      .then((session) => setPhase({ status: "consent", session }))
      .catch((e: unknown) => {
        if (
          e instanceof ApiError &&
          (e.status === 410 || e.message === "session-expired")
        ) {
          setPhase({ status: "expired" });
          return;
        }
        setPhase({
          status: "error",
          message: humanError(e instanceof ApiError ? e.message : "unknown"),
        });
      });

    return () => {
      cameraRef.current?.release();
    };
  }, [sessionToken]);

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
      setPhase({ status: "error", message: humanError((e as Error).message) });
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
    setPhase({ status: "permission", session });
  };

  const requestCamera = async (session: GuardianSessionView) => {
    try {
      const camera = await openFrontCamera();
      cameraRef.current = camera;
      setPhase({ status: "guide", session, stepIndex: 0 });
    } catch {
      setPhase({
        status: "error",
        message:
          "No pude acceder a tu cámara. Revisa los permisos de cámara de Telegram/tu navegador e inténtalo de nuevo.",
      });
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
        (e: Error) => ({ error: e.message }),
      );
      if ("error" in startResult) {
        setPhase({ status: "error", message: humanError(startResult.error) });
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

    setPhase({ status: "capturing", session });

    let mediaBase64: string;
    try {
      const frames = await captureBurst(video, 1, 0);
      const frame = frames[0];
      if (!frame) {
        throw new Error("no-frame-captured");
      }
      mediaBase64 = await blobToBase64(frame.blob);
    } catch {
      setPhase({ status: "technical-failure" });
      releaseCamera();
      return;
    }

    if (!isLastStep) {
      // More gestures to go (double verification's second photo) — hold this
      // photo and re-guide for the next step instead of submitting yet.
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
      setPhase({ status: "error", message: humanError((e as Error).message) });
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
      </Screen>
    );
  }

  if (phase.status === "error") {
    return (
      <Screen>
        <AppHeader glyph="⚠️" tone="red" title="Guardian Verification" />
        <Banner kind="error">{phase.message}</Banner>
      </Screen>
    );
  }

  if (phase.status === "consent") {
    return (
      <Screen>
        <AppHeader
          glyph="🛡️"
          tone="blue"
          title="Verificación de entrada"
          subtitle="Antes de continuar, esto es lo que va a pasar"
        />
        <Section caption="Qué vamos a hacer">
          <ul className="guardian-consent-list">
            <li>
              Se abrirá tu cámara frontal y te pediremos una foto en la que se
              vea tu cara y un gesto con la mano.
            </li>
            <li>
              Una IA comprobará que eres una persona real, que haces el gesto
              pedido y estimará tu edad.
            </li>
            <li>
              El objetivo es comprobar que eres una persona real y cumples los
              requisitos para entrar al grupo.
            </li>
            <li>
              La foto y el análisis los podrá ver el equipo STAFF autorizado del
              grupo.
            </li>
            <li>
              La foto se eliminará automáticamente pasado el periodo de
              retención configurado.
            </li>
            <li>
              No se usará para entrenar ningún modelo de inteligencia
              artificial.
            </li>
            <li>
              Si el resultado no es concluyente, un moderador humano revisará tu
              caso.
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
            hint="El equipo del grupo verá esta edad junto a la que estime la IA a partir de tu foto."
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
    return (
      <Screen>
        <AppHeader
          glyph="📷"
          tone="blue"
          title="Activar la cámara"
          subtitle="Solo se usará la cámara frontal"
        />
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
        <Banner kind="success">
          Tu solicitud ha sido aprobada automáticamente.
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

export default function GuardianVerifyPage() {
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
