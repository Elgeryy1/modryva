"use client";

import { useEffect, useState } from "react";
import {
  deleteWelcomePhoto,
  getWelcomePhoto,
  uploadWelcomePhoto,
  type WelcomeButton,
  type WelcomeButtonType,
} from "../lib/api";
import {
  ANTIRAID_MODES,
  CAPTCHA_FAIL_ACTIONS,
  CAPTCHA_MODES,
  FLOOD_ACTIONS,
  LOCK_TYPES,
  WARN_MODES,
} from "../lib/config-meta";
import { getMainButton } from "../lib/telegram";
import {
  AppHeader,
  Banner,
  Button,
  Caption,
  Field,
  Group,
  Row,
  Segmented,
  Toggle,
  type Tone,
  useMainButton,
} from "./ui";

type Value = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" ? v : fallback;
const bool = (v: unknown): boolean => v === true;
// durationMs/expireMs travel as milliseconds; the form edits whole minutes.
const msToMin = (v: unknown, fallback: number): number =>
  typeof v === "number" && v > 0 ? Math.round(v / 60000) : fallback;
const minToMs = (min: number): number => Math.max(0, Math.round(min)) * 60000;

interface SectionMeta {
  title: string;
  sub: string;
  icon: string;
  tone: Tone;
}
const SECTION_META: Record<string, SectionMeta> = {
  behavior: {
    title: "Comportamiento del bot",
    sub: "Modo pasivo: qué hace el bot y qué no",
    icon: "🎛️",
    tone: "blue",
  },
  welcome: {
    title: "Bienvenida",
    sub: "Saludo y despedida automáticos",
    icon: "👋",
    tone: "green",
  },
  rules: {
    title: "Reglas",
    sub: "El texto que muestra /reglas",
    icon: "📋",
    tone: "blue",
  },
  flood: {
    title: "Antiflood",
    sub: "Frena el spam por exceso de mensajes",
    icon: "🌊",
    tone: "teal",
  },
  captcha: {
    title: "Captcha",
    sub: "Verifica a los nuevos antes de escribir",
    icon: "🛡️",
    tone: "purple",
  },
  locks: {
    title: "Locks de contenido",
    sub: "Bloquea tipos de mensaje concretos",
    icon: "🔒",
    tone: "orange",
  },
  warns: {
    title: "Avisos",
    sub: "Cuántos avisos antes de sancionar",
    icon: "⚠️",
    tone: "orange",
  },
  hygiene: {
    title: "Limpieza y modo noche",
    sub: "Borra mensajes de servicio y silencia de noche",
    icon: "🌙",
    tone: "purple",
  },
  membershipGate: {
    title: "Grupo requerido",
    sub: "Exige pertenecer a otro grupo para estar en este",
    icon: "🔗",
    tone: "blue",
  },
  raid: {
    title: "Antiraid",
    sub: "Detecta oleadas de entradas y actúa",
    icon: "🛡️",
    tone: "red",
  },
};

// Friendly Spanish labels over the raw enum values the API expects.
const FLOOD_ACTION_LABELS: Record<string, string> = {
  warn: "Avisar",
  mute: "Silenciar",
  ban: "Expulsar",
  delete: "Borrar",
};
const WARN_MODE_LABELS: Record<string, string> = {
  ban: "Expulsar",
  kick: "Sacar",
  mute: "Silenciar",
  tban: "Expulsión temporal",
  tmute: "Silencio temporal",
};
const CAPTCHA_MODE_LABELS: Record<string, string> = {
  button: "Botón",
  math: "Cálculo",
  text: "Texto",
};
const CAPTCHA_FAIL_LABELS: Record<string, string> = {
  mute: "Silenciar",
  ban: "Expulsar",
  restrict: "Restringir",
};
const LOCK_LABELS: Record<string, string> = {
  text: "Texto",
  url: "Enlaces",
  mention: "Menciones",
  forward: "Reenvíos",
  via_bot: "Vía bot",
  photo: "Fotos",
  video: "Vídeos",
  gif: "GIFs",
  sticker: "Stickers",
  audio: "Audios",
  voice: "Notas de voz",
  document: "Archivos",
  contact: "Contactos",
  location: "Ubicación",
  poll: "Encuestas",
};

const segOptions = (
  values: readonly string[],
  labels: Record<string, string>,
) => values.map((value) => ({ value, label: labels[value] ?? value }));

const WELCOME_BUTTON_LABELS: Record<WelcomeButtonType, string> = {
  rules: "📜 Reglas",
  url: "🔗 Enlace",
  contact_admins: "💬 Contactar admins",
  miniapp: "📱 Abrir Mini App",
};

const isSafeWelcomeUrl = (url: string): boolean =>
  /^(https?:\/\/|tg:\/\/)/iu.test(url.trim());

// Keeps only complete, valid buttons (what the API + bot accept). Editor drafts
// may be temporarily incomplete; this is the subset that actually gets saved.
const cleanWelcomeButtons = (list: WelcomeButton[]): WelcomeButton[] =>
  list
    .map((button) =>
      button.type === "url" && button.url
        ? {
            type: button.type,
            text: button.text.trim(),
            url: button.url.trim(),
          }
        : { type: button.type, text: button.text.trim() },
    )
    .filter(
      (button) =>
        button.text !== "" &&
        (button.type !== "url" || isSafeWelcomeUrl(button.url ?? "")),
    )
    .slice(0, 6);

const replaceAt = <T,>(arr: T[], index: number, item: T): T[] =>
  arr.map((value, i) => (i === index ? item : value));

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });

function WelcomeButtonsEditor({
  initial,
  onChange,
}: {
  initial: WelcomeButton[];
  onChange: (buttons: WelcomeButton[]) => void;
}) {
  const [drafts, setDrafts] = useState<WelcomeButton[]>(initial);
  const update = (next: WelcomeButton[]) => {
    setDrafts(next);
    onChange(cleanWelcomeButtons(next));
  };

  return (
    <Field
      label="Botones"
      hint="Se muestran bajo el mensaje. «Reglas» y «Contactar admins» funcionan solos; «Enlace» necesita una URL (https:// o tg://)."
    >
      {drafts.length === 0 && <Caption>Sin botones todavía.</Caption>}
      {drafts.map((button, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: buttons have no stable id and aren't reordered
          key={i}
          style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}
        >
          <select
            className="input"
            style={{ flex: "0 0 auto", maxWidth: 160 }}
            value={button.type}
            onChange={(e) =>
              update(
                replaceAt(drafts, i, {
                  ...button,
                  type: e.target.value as WelcomeButtonType,
                }),
              )
            }
          >
            {(Object.keys(WELCOME_BUTTON_LABELS) as WelcomeButtonType[]).map(
              (type) => (
                <option key={type} value={type}>
                  {WELCOME_BUTTON_LABELS[type]}
                </option>
              ),
            )}
          </select>
          <input
            className="input"
            style={{ flex: 1, minWidth: 120 }}
            placeholder="Texto del botón"
            value={button.text}
            onChange={(e) =>
              update(replaceAt(drafts, i, { ...button, text: e.target.value }))
            }
          />
          {button.type === "url" && (
            <input
              className="input"
              style={{ flex: 1, minWidth: 120 }}
              placeholder="https://…"
              value={button.url ?? ""}
              onChange={(e) =>
                update(replaceAt(drafts, i, { ...button, url: e.target.value }))
              }
            />
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => update(drafts.filter((_, j) => j !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
      {drafts.length < 6 && (
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            update([
              ...drafts,
              { type: "rules", text: WELCOME_BUTTON_LABELS.rules },
            ])
          }
        >
          + Añadir botón
        </Button>
      )}
    </Field>
  );
}

function WelcomePhotoField({ gid }: { gid: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getWelcomePhoto(gid)
      .then((r) => {
        if (r.imageBase64 && r.mimeType) {
          setPreview(`data:${r.mimeType};base64,${r.imageBase64}`);
        }
      })
      .catch(() => {
        /* no photo yet, or not reachable — leave the field empty */
      });
  }, [gid]);

  const pick = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setMsg("La imagen supera los 5 MB.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const dataUrl = await readAsDataUrl(file);
      const base64 = dataUrl.split(",")[1] ?? "";
      await uploadWelcomePhoto(gid, base64, file.type);
      setPreview(dataUrl);
      setMsg("Foto guardada.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await deleteWelcomePhoto(gid);
      setPreview(null);
      setMsg("Foto quitada.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo quitar la foto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field
      label="Foto de bienvenida"
      hint="Se envía como foto con el mensaje encima. Se guarda al subirla (no con el botón Guardar)."
    >
      {preview && (
        // biome-ignore lint/performance/noImgElement: a data: URL preview; next/image can't optimize it
        <img
          src={preview}
          alt="Vista previa de la bienvenida"
          style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 8 }}
        />
      )}
      <input
        className="input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void pick(file);
          }
        }}
      />
      {preview && (
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => void remove()}
        >
          Quitar foto
        </Button>
      )}
      {msg && <Caption>{msg}</Caption>}
    </Field>
  );
}

export function SectionForm({
  section,
  gid,
  initial,
  onSave,
  saving,
  error,
}: {
  section: string;
  gid?: string;
  initial: Value;
  onSave: (next: Value) => void;
  saving: boolean;
  error: string | null;
}) {
  const [v, setV] = useState<Value>(initial);
  const set = (patch: Value) => setV((prev) => ({ ...prev, ...patch }));
  const meta = SECTION_META[section] ?? {
    title: section,
    sub: "",
    icon: "⚙️",
    tone: "gray" as Tone,
  };

  // Save from Telegram's native bottom button. Falls back to an in-page button
  // when the SDK isn't present (e.g. opened outside Telegram).
  const [hasMainButton, setHasMainButton] = useState(false);
  useEffect(() => {
    setHasMainButton(Boolean(getMainButton()));
  }, []);
  useMainButton({
    text: saving ? "Guardando…" : "Guardar",
    onClick: () => onSave(v),
    loading: saving,
    enabled: !saving,
  });

  return (
    <>
      <AppHeader
        glyph={meta.icon}
        tone={meta.tone}
        title={meta.title}
        subtitle={meta.sub}
      />

      {section === "welcome" && (
        <>
          <Field
            label="Mensaje de bienvenida"
            hint="Usa {first_name} para el nombre y {chat_title} para el grupo."
          >
            <textarea
              className="textarea"
              rows={4}
              value={str(v.welcomeText)}
              onChange={(e) =>
                set({
                  welcomeText: e.target.value === "" ? null : e.target.value,
                })
              }
              placeholder="Hola {first_name}, bienvenido a {chat_title} 👋"
            />
          </Field>
          <Field
            label="Mensaje de despedida"
            hint="Se envía cuando alguien sale."
          >
            <textarea
              className="textarea"
              rows={3}
              value={str(v.goodbyeText)}
              onChange={(e) =>
                set({
                  goodbyeText: e.target.value === "" ? null : e.target.value,
                })
              }
              placeholder="Adiós {first_name} 👋"
            />
          </Field>
          {gid && <WelcomePhotoField gid={gid} />}
          <WelcomeButtonsEditor
            initial={
              Array.isArray(v.welcomeButtons)
                ? (v.welcomeButtons as WelcomeButton[])
                : []
            }
            onChange={(buttons) => set({ welcomeButtons: buttons })}
          />
        </>
      )}

      {section === "rules" && (
        <Field
          label="Reglas del grupo"
          hint="Se muestran cuando alguien escribe /reglas."
        >
          <textarea
            className="textarea"
            rows={7}
            value={str(v.rulesText)}
            onChange={(e) =>
              set({ rulesText: e.target.value === "" ? null : e.target.value })
            }
            placeholder="1. Respeta a todos&#10;2. Nada de spam&#10;3. …"
          />
        </Field>
      )}

      {section === "flood" && (
        <>
          <Group>
            <Row
              icon="🌊"
              tone="teal"
              title="Antiflood activo"
              subtitle="Actúa cuando alguien escribe de más"
              trailing={
                <Toggle
                  label="Antiflood activo"
                  checked={bool(v.enabled)}
                  onChange={(next) => set({ enabled: next })}
                />
              }
            />
          </Group>
          <Field label="Límite de mensajes" hint="Entre 3 y 20 mensajes.">
            <input
              className="input"
              type="number"
              min={3}
              max={20}
              value={num(v.messageLimit, 5)}
              onChange={(e) => set({ messageLimit: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Ventana (segundos)"
            hint="Periodo en el que se cuentan los mensajes."
          >
            <input
              className="input"
              type="number"
              min={1}
              value={num(v.windowSeconds, 10)}
              onChange={(e) => set({ windowSeconds: Number(e.target.value) })}
            />
          </Field>
          <Field label="Acción al saltar">
            <Segmented
              options={segOptions(FLOOD_ACTIONS, FLOOD_ACTION_LABELS)}
              value={str(v.action) || "mute"}
              onChange={(action) => set({ action })}
            />
          </Field>
        </>
      )}

      {section === "captcha" && (
        <>
          <Group>
            <Row
              icon="🛡️"
              tone="purple"
              title="Captcha activo"
              subtitle="Pide verificación a los nuevos miembros"
              trailing={
                <Toggle
                  label="Captcha activo"
                  checked={bool(v.enabled)}
                  onChange={(next) => set({ enabled: next })}
                />
              }
            />
          </Group>
          <Field label="Modo">
            <Segmented
              options={segOptions(CAPTCHA_MODES, CAPTCHA_MODE_LABELS)}
              value={str(v.mode) || "button"}
              onChange={(mode) => set({ mode })}
            />
          </Field>
          <Field label="Si falla">
            <Segmented
              options={segOptions(CAPTCHA_FAIL_ACTIONS, CAPTCHA_FAIL_LABELS)}
              value={str(v.failAction) || "mute"}
              onChange={(failAction) => set({ failAction })}
            />
          </Field>
          <Field label="Tiempo límite (segundos)">
            <input
              className="input"
              type="number"
              min={1}
              value={num(v.timeoutSeconds, 120)}
              onChange={(e) => set({ timeoutSeconds: Number(e.target.value) })}
            />
          </Field>
          <Field label="Intentos máximos">
            <input
              className="input"
              type="number"
              min={1}
              max={10}
              value={num(v.maxAttempts, 3)}
              onChange={(e) => set({ maxAttempts: Number(e.target.value) })}
            />
          </Field>
        </>
      )}

      {section === "locks" && (
        <div className="sec">
          <Caption>Contenido bloqueado</Caption>
          <Group>
            {LOCK_TYPES.map((type) => {
              const locked = Array.isArray(v.locked)
                ? (v.locked as string[])
                : [];
              const on = locked.includes(type);
              return (
                <Row
                  key={type}
                  title={LOCK_LABELS[type] ?? type}
                  trailing={
                    <Toggle
                      label={LOCK_LABELS[type] ?? type}
                      checked={on}
                      onChange={(next) =>
                        set({
                          locked: next
                            ? [...locked, type]
                            : locked.filter((t) => t !== type),
                        })
                      }
                    />
                  }
                />
              );
            })}
          </Group>
        </div>
      )}

      {section === "warns" && (
        <>
          <Field
            label="Límite de avisos"
            hint="Cuántos avisos acumula alguien antes de la sanción (1-20)."
          >
            <input
              className="input"
              type="number"
              min={1}
              max={20}
              value={num(v.warnLimit, 3)}
              onChange={(e) => set({ warnLimit: Number(e.target.value) })}
            />
          </Field>
          <Field label="Sanción al llegar al límite">
            <Segmented
              options={segOptions(WARN_MODES, WARN_MODE_LABELS)}
              value={str(v.warnMode) || "mute"}
              onChange={(warnMode) => set({ warnMode })}
            />
          </Field>
          {(str(v.warnMode) === "tban" || str(v.warnMode) === "tmute") && (
            <Field
              label="Duración de la sanción (minutos)"
              hint="Tiempo que dura la expulsión o el silencio temporal."
            >
              <input
                className="input"
                type="number"
                min={1}
                value={msToMin(v.durationMs, 60)}
                onChange={(e) =>
                  set({ durationMs: minToMs(Number(e.target.value)) })
                }
              />
            </Field>
          )}
          <Field
            label="Caducidad de los avisos (minutos)"
            hint="Los avisos se olvidan solos tras este tiempo. 0 = nunca caducan."
          >
            <input
              className="input"
              type="number"
              min={0}
              value={msToMin(v.expireMs, 0)}
              onChange={(e) => {
                const mins = Number(e.target.value);
                set({ expireMs: mins > 0 ? minToMs(mins) : null });
              }}
            />
          </Field>
        </>
      )}

      {section === "behavior" && (
        <>
          <Group>
            <Row
              icon="🎛️"
              tone="blue"
              title="Modo pasivo"
              subtitle="El bot hace SOLO verificación y juegos: no modera, no limpia, no manda mensajes automáticos y apaga los comandos de moderación. Ideal si ya tienes otro bot (p. ej. GroupHelp) moderando. Tiene prioridad sobre las categorías de abajo."
              trailing={
                <Toggle
                  label="Modo pasivo"
                  checked={bool(v.passiveMode)}
                  onChange={(next) => set({ passiveMode: next })}
                />
              }
            />
          </Group>

          <div className="sec">
            <Caption>
              Control por categorías (con el modo pasivo apagado)
            </Caption>
            <Group>
              <Row
                icon="🛡️"
                tone="red"
                title="Moderación automática"
                subtitle="Expulsar, silenciar, avisos, antiflood, antiraid, blocklist, locks, modo noche…"
                trailing={
                  <Toggle
                    label="Moderación automática"
                    checked={bool(v.autoModeration)}
                    onChange={(next) => set({ autoModeration: next })}
                  />
                }
              />
              <Row
                icon="🧹"
                tone="teal"
                title="Limpieza automática"
                subtitle="Borrar mensajes de servicio: entradas, salidas y cambios de grupo"
                trailing={
                  <Toggle
                    label="Limpieza automática"
                    checked={bool(v.autoCleanup)}
                    onChange={(next) => set({ autoCleanup: next })}
                  />
                }
              />
              <Row
                icon="💬"
                tone="green"
                title="Mensajes automáticos"
                subtitle="Bienvenida, despedida, celebraciones, onboarding y avisos de AFK"
                trailing={
                  <Toggle
                    label="Mensajes automáticos"
                    checked={bool(v.autoMessages)}
                    onChange={(next) => set({ autoMessages: next })}
                  />
                }
              />
            </Group>
          </div>
        </>
      )}

      {section === "hygiene" && (
        <>
          <Group>
            <Row
              icon="🧹"
              tone="teal"
              title="Borrar mensajes de servicio"
              subtitle="Quita los avisos de entrada, salida y cambios"
              trailing={
                <Toggle
                  label="Borrar mensajes de servicio"
                  checked={bool(v.cleanService)}
                  onChange={(next) => set({ cleanService: next })}
                />
              }
            />
            <Row
              icon="👋"
              tone="green"
              title="Borrar bienvenida anterior"
              subtitle="Deja solo el último saludo en el chat"
              trailing={
                <Toggle
                  label="Borrar bienvenida anterior"
                  checked={bool(v.cleanWelcome)}
                  onChange={(next) => set({ cleanWelcome: next })}
                />
              }
            />
            <Row
              icon="🚨"
              tone="red"
              title="Bloquear spammers conocidos"
              subtitle="Banea al entrar a quien ya está fichado en CAS (Combot Anti-Spam)"
              trailing={
                <Toggle
                  label="Bloquear spammers conocidos"
                  checked={bool(v.blockKnownSpammers)}
                  onChange={(next) => set({ blockKnownSpammers: next })}
                />
              }
            />
            <Row
              icon="🔇"
              tone="orange"
              title="Silenciar al entrar"
              subtitle="Los nuevos entran en silencio hasta verificar"
              trailing={
                <Toggle
                  label="Silenciar al entrar"
                  checked={bool(v.welcomeMute)}
                  onChange={(next) => set({ welcomeMute: next })}
                />
              }
            />
          </Group>

          <div className="sec">
            <Caption>Solicitudes y filtros</Caption>
            <Group>
              <Row
                icon="✅"
                tone="green"
                title="Auto-aprobar solicitudes"
                subtitle="Acepta al instante las solicitudes de entrada al grupo"
                trailing={
                  <Toggle
                    label="Auto-aprobar solicitudes"
                    checked={bool(v.autoApprove)}
                    onChange={(next) => set({ autoApprove: next })}
                  />
                }
              />
              <Row
                icon="🔤"
                tone="blue"
                title="Filtro RTL"
                subtitle="Borra mensajes que abusan de texto de derecha a izquierda"
                trailing={
                  <Toggle
                    label="Filtro RTL"
                    checked={bool(v.rtlFilter)}
                    onChange={(next) => set({ rtlFilter: next })}
                  />
                }
              />
              <Row
                icon="🈲"
                tone="purple"
                title="Filtro CJK"
                subtitle="Borra mensajes con abuso de caracteres chinos, japoneses o coreanos"
                trailing={
                  <Toggle
                    label="Filtro CJK"
                    checked={bool(v.cjkFilter)}
                    onChange={(next) => set({ cjkFilter: next })}
                  />
                }
              />
            </Group>
            <Field
              label="Idioma del bot"
              hint="Idioma de los mensajes del bot en este grupo."
            >
              <Segmented
                options={[
                  { value: "es", label: "Español" },
                  { value: "en", label: "English" },
                ]}
                value={str(v.language) === "en" ? "en" : "es"}
                onChange={(next) => set({ language: next })}
              />
            </Field>
          </div>

          <div className="sec">
            <Caption>Modo noche</Caption>
            <Group>
              <Row
                icon="🌙"
                tone="purple"
                title="Modo noche"
                subtitle="Cierra el chat en el horario indicado"
                trailing={
                  <Toggle
                    label="Modo noche"
                    checked={bool(v.nightMode)}
                    onChange={(next) => set({ nightMode: next })}
                  />
                }
              />
            </Group>
          </div>

          {bool(v.nightMode) && (
            <>
              <Field
                label="Hora de inicio"
                hint="Hora (0-23) en la que empieza."
              >
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={23}
                  value={num(v.nightStart, 23)}
                  onChange={(e) => set({ nightStart: Number(e.target.value) })}
                />
              </Field>
              <Field label="Hora de fin" hint="Hora (0-23) en la que termina.">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={23}
                  value={num(v.nightEnd, 7)}
                  onChange={(e) => set({ nightEnd: Number(e.target.value) })}
                />
              </Field>
            </>
          )}
        </>
      )}

      {section === "membershipGate" && (
        <Field
          label="ID del grupo requerido"
          hint="Quien no esté (o deje de estar) en ese grupo no puede seguir en este. Añade el bot como ADMINISTRADOR del otro grupo para detectar salidas al instante. Pide el ID numérico a un bot como @getidsbot o @RawDataBot dentro del otro grupo (algo como -1001234567890). Déjalo vacío para quitar el requisito."
        >
          <input
            className="input"
            type="text"
            inputMode="numeric"
            value={str(v.requiredTelegramChatId)}
            onChange={(e) => {
              const next = e.target.value.trim();
              set({
                requiredTelegramChatId:
                  next === "" ? null : next.replace(/[^-\d]/gu, ""),
              });
            }}
            placeholder="-1001234567890"
          />
        </Field>
      )}

      {section === "raid" && (
        <>
          <Group>
            <Row
              icon="🛡️"
              tone="red"
              title="Antiraid"
              subtitle="Detecta muchas entradas seguidas (un raid) y reacciona"
              trailing={
                <Toggle
                  label="Antiraid"
                  checked={bool(v.enabled)}
                  onChange={(next) => set({ enabled: next })}
                />
              }
            />
          </Group>

          {bool(v.enabled) && (
            <>
              <Field
                label="Qué hago al detectar un raid"
                hint="Observar solo avisa en los logs; Actuar restringe las entradas del raid."
              >
                <Segmented
                  options={ANTIRAID_MODES.map((m) => ({
                    value: m,
                    label: m === "enforce" ? "Actuar" : "Observar",
                  }))}
                  value={str(v.mode) === "enforce" ? "enforce" : "observe"}
                  onChange={(next) => set({ mode: next })}
                />
              </Field>
              <Field
                label="Entradas para considerarlo un raid"
                hint="Número de entradas dentro de la ventana que dispara el antiraid."
              >
                <input
                  className="input"
                  type="number"
                  min={2}
                  max={100}
                  value={num(v.joinLimit, 5)}
                  onChange={(e) => set({ joinLimit: Number(e.target.value) })}
                />
              </Field>
              <Field
                label="Ventana (segundos)"
                hint="Periodo en el que se cuentan las entradas."
              >
                <input
                  className="input"
                  type="number"
                  min={5}
                  max={3600}
                  value={num(v.windowSeconds, 30)}
                  onChange={(e) =>
                    set({ windowSeconds: Number(e.target.value) })
                  }
                />
              </Field>
              <Field
                label="Cuentas nuevas (días)"
                hint="Trata como sospechosas las cuentas creadas hace menos de estos días. 0 lo desactiva."
              >
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={365}
                  value={num(v.newAccountAgeDays, 0)}
                  onChange={(e) =>
                    set({ newAccountAgeDays: Number(e.target.value) })
                  }
                />
              </Field>
            </>
          )}
        </>
      )}

      {error && <Banner kind="error">{error}</Banner>}

      {!hasMainButton && (
        <Button
          type="button"
          variant="primary"
          block
          disabled={saving}
          onClick={() => onSave(v)}
        >
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      )}
    </>
  );
}
