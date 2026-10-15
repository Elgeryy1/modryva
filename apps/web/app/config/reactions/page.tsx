"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Field,
  Group,
  GroupNote,
  Row,
  Screen,
  Section,
  Segmented,
  SkeletonList,
  useBackButton,
} from "../../../components/ui";
import {
  getReactions,
  putReactions,
  type ReactionModerationConfig,
} from "../../../lib/api";
import { haptic, ready } from "../../../lib/telegram";

// Mirrors SUGGESTED_ABUSIVE_REACTIONS in @superbot/module-security (offered as
// quick-add chips; never applied unless the admin picks them).
const SUGGESTED_EMOJIS = ["🖕", "💩", "🤡", "🤮", "👎"] as const;

const MODE_OPTIONS: ReadonlyArray<{
  value: ReactionModerationConfig["mode"];
  label: string;
}> = [
  { value: "off", label: "Apagado" },
  { value: "shadow", label: "Observar" },
  { value: "enforce", label: "Retirar" },
];

const MODE_HINT: Record<ReactionModerationConfig["mode"], string> = {
  off: "No evalúo ninguna reacción (por defecto).",
  shadow: "Detecto y registro las reacciones vetadas, pero no retiro nada.",
  enforce:
    "Retiro las reacciones vetadas. Necesito ser administrador con permiso para eliminar mensajes.",
};

const clampInt = (
  value: number,
  min: number,
  max: number,
  fallback: number,
): number =>
  Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.trunc(value)))
    : fallback;

/** A labelled text box + button that appends a trimmed, non-empty value. */
function TextAdder({
  label,
  hint,
  placeholder,
  addLabel,
  onAdd,
}: {
  label: string;
  hint: string;
  placeholder: string;
  addLabel: string;
  onAdd: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const value = draft.trim();
    if (value.length > 0) {
      onAdd(value);
      setDraft("");
    }
  };
  return (
    <>
      <Field label={label} hint={hint}>
        <input
          className="input"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
      </Field>
      <Button
        variant="secondary"
        block
        disabled={draft.trim().length === 0}
        onClick={commit}
      >
        {addLabel}
      </Button>
    </>
  );
}

function ReactionsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [config, setConfig] = useState<ReactionModerationConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackButton(() => router.back());

  useEffect(() => {
    ready();
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      return;
    }
    getReactions(gid)
      .then((res) => setConfig(res.config))
      .catch((e: Error) => setError(e.message));
  }, [gid]);

  const patch = useCallback((next: Partial<ReactionModerationConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...next } : prev));
    setDirty(true);
  }, []);

  const addTo = useCallback(
    (key: "blockedEmojis" | "blockedCustomEmojiIds", value: string) => {
      setConfig((prev) => {
        if (!prev) {
          return prev;
        }
        const trimmed = value.trim();
        if (trimmed.length === 0 || prev[key].includes(trimmed)) {
          return prev;
        }
        return { ...prev, [key]: [...prev[key], trimmed] };
      });
      setDirty(true);
    },
    [],
  );

  const removeFrom = useCallback(
    (key: "blockedEmojis" | "blockedCustomEmojiIds", value: string) => {
      setConfig((prev) =>
        prev ? { ...prev, [key]: prev[key].filter((v) => v !== value) } : prev,
      );
      setDirty(true);
    },
    [],
  );

  const onSave = useCallback(async () => {
    if (!config || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await putReactions(gid, config);
      setConfig(res.config);
      setDirty(false);
      haptic.notify("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [config, gid, busy]);

  if (config === null) {
    return (
      <Screen>
        <AppHeader
          glyph="😠"
          tone="orange"
          title="Moderación de reacciones"
          subtitle="Retira reacciones con emojis vetados y avisa de brigadas"
        />
        {error && <Banner kind="error">{error}</Banner>}
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  const suggestions = SUGGESTED_EMOJIS.filter(
    (emoji) => !config.blockedEmojis.includes(emoji),
  );

  return (
    <Screen>
      <AppHeader
        glyph="😠"
        tone="orange"
        title="Moderación de reacciones"
        subtitle="Retira reacciones con emojis vetados y avisa de brigadas"
      />

      {error && <Banner kind="error">{error}</Banner>}

      <Section caption="Modo">
        <Field
          label="Qué hago con las reacciones vetadas"
          hint={MODE_HINT[config.mode]}
        >
          <Segmented
            options={MODE_OPTIONS}
            value={config.mode}
            onChange={(mode) => patch({ mode })}
          />
        </Field>
      </Section>

      <Section caption="Emojis vetados">
        {config.blockedEmojis.length > 0 && (
          <Group>
            {config.blockedEmojis.map((emoji) => (
              <Row
                key={emoji}
                icon={emoji}
                tone="orange"
                title={emoji}
                trailing={
                  <Button
                    variant="ghost"
                    aria-label={`Quitar ${emoji}`}
                    onClick={() => removeFrom("blockedEmojis", emoji)}
                  >
                    ×
                  </Button>
                }
              />
            ))}
          </Group>
        )}
        <TextAdder
          label="Añadir un emoji"
          hint="Pega el emoji tal cual (p. ej. 🖕). Se usa como reacción vetada."
          placeholder="🖕"
          addLabel="Añadir emoji"
          onAdd={(value) => addTo("blockedEmojis", value)}
        />
        {suggestions.length > 0 && (
          <Group>
            {suggestions.map((emoji) => (
              <Row
                key={emoji}
                icon={emoji}
                tone="gray"
                title={emoji}
                subtitle="Sugerido"
                trailing={
                  <Button
                    variant="ghost"
                    aria-label={`Añadir ${emoji}`}
                    onClick={() => addTo("blockedEmojis", emoji)}
                  >
                    ＋
                  </Button>
                }
              />
            ))}
          </Group>
        )}
      </Section>

      <Section caption="Emojis personalizados vetados (por ID)">
        {config.blockedCustomEmojiIds.length > 0 && (
          <Group>
            {config.blockedCustomEmojiIds.map((id) => (
              <Row
                key={id}
                icon="🧩"
                tone="orange"
                title={id}
                trailing={
                  <Button
                    variant="ghost"
                    aria-label={`Quitar ${id}`}
                    onClick={() => removeFrom("blockedCustomEmojiIds", id)}
                  >
                    ×
                  </Button>
                }
              />
            ))}
          </Group>
        )}
        <TextAdder
          label="Añadir un emoji personalizado"
          hint="El identificador (custom_emoji_id) del emoji premium que quieres vetar."
          placeholder="5368324170671202286"
          addLabel="Añadir ID"
          onAdd={(value) => addTo("blockedCustomEmojiIds", value)}
        />
      </Section>

      <Section caption="Brigadas (aviso al equipo)">
        <Field
          label="Reactores distintos para avisar"
          hint="Cuántas cuentas distintas reaccionando con un emoji vetado sobre un mismo mensaje disparan un aviso al equipo (2–1000)."
        >
          <input
            className="input"
            type="number"
            min={2}
            max={1000}
            value={config.surgeThreshold}
            onChange={(e) =>
              patch({
                surgeThreshold: clampInt(Number(e.target.value), 2, 1000, 12),
              })
            }
          />
        </Field>
        <Field
          label="Ventana (segundos)"
          hint="En cuántos segundos se cuentan esos reactores (5–3600)."
        >
          <input
            className="input"
            type="number"
            min={5}
            max={3600}
            value={config.surgeWindowSeconds}
            onChange={(e) =>
              patch({
                surgeWindowSeconds: clampInt(
                  Number(e.target.value),
                  5,
                  3600,
                  30,
                ),
              })
            }
          />
        </Field>
      </Section>

      <Button
        variant="primary"
        block
        disabled={busy || !dirty}
        onClick={() => void onSave()}
      >
        {busy ? "Guardando…" : dirty ? "Guardar cambios" : "Guardado"}
      </Button>

      <GroupNote>
        Retirar una reacción borra TODAS las reacciones de esa persona en ese
        mensaje: Telegram identifica a quien reacciona, no al emoji concreto. En
        modo «Retirar» necesito ser administrador con permiso para eliminar
        mensajes; si me falta, aviso al equipo en lugar de fallar en silencio.
        Nunca retiro reacciones en masa de forma automática.
      </GroupNote>
    </Screen>
  );
}

export default function ReactionsPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <ReactionsInner />
    </Suspense>
  );
}
