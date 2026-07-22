"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Empty,
  Field,
  Group,
  GroupNote,
  Row,
  Screen,
  Section,
  Segmented,
  SkeletonList,
  Toggle,
  type Tone,
  useBackButton,
} from "../../../components/ui";
import {
  type BotPurpose,
  type GamesConfig,
  type GameToggles,
  getGamesConfig,
  postSession,
  putGamesConfig,
  type TriviaCadence,
} from "../../../lib/api";
import { decodeStartParam } from "../../../lib/config-meta";
import { getStartParam, haptic, ready } from "../../../lib/telegram";

const ERROR_LABELS: Record<string, string> = {
  "not-admin":
    "Solo los administradores del grupo pueden configurarlo. Si te acaban de dar admin, espera unos segundos y vuelve a abrirlo.",
  "chat-not-found":
    "No encuentro este grupo. Escribe /settings dentro del grupo para configurarlo.",
};
const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

// Mirror of @superbot/shared's recommendedPurpose (the web can't import server
// values from the shared barrel). Template drives the DEFAULT only — every
// purpose stays available, so nothing is hidden for a given bot template.
const recommendedPurpose = (template?: string | null): BotPurpose => {
  switch (template) {
    case "support":
    case "business":
      return "moderate";
    case "creator":
      return "play";
    default:
      return "both";
  }
};

interface PurposeOption {
  id: BotPurpose;
  icon: string;
  tone: Tone;
  title: string;
  sub: string;
}
const PURPOSE_OPTIONS: readonly PurposeOption[] = [
  {
    id: "moderate",
    icon: "🛡️",
    tone: "blue",
    title: "Administrar",
    sub: "Moderación, bienvenida, captcha y antispam. Sin ruido en el chat.",
  },
  {
    id: "play",
    icon: "🎮",
    tone: "purple",
    title: "Jugar",
    sub: "Minijuegos, trivia y jefes. Anuncio la trivia en el grupo.",
  },
  {
    id: "both",
    icon: "✨",
    tone: "brand",
    title: "Las dos",
    sub: "Modero el grupo y además lo animo con juegos.",
  },
];

interface GameToggleMeta {
  key: keyof GameToggles;
  icon: string;
  tone: Tone;
  title: string;
  sub: string;
}
const GAME_META: readonly GameToggleMeta[] = [
  {
    key: "dailytrivia",
    icon: "🗓️",
    tone: "green",
    title: "Trivia de comunidad",
    sub: "Una pregunta compartida para todo el grupo.",
  },
  {
    key: "boss",
    icon: "⚔️",
    tone: "red",
    title: "Boss cooperativo",
    sub: "El grupo derriba a un jefe entre todos.",
  },
  {
    key: "tictactoe",
    icon: "⭕",
    tone: "green",
    title: "Tres en raya",
    sub: "Contra la IA del bot.",
  },
  {
    key: "rps",
    icon: "✊",
    tone: "pink",
    title: "Piedra, papel o tijera",
    sub: "Al mejor de 5.",
  },
  {
    key: "quiz",
    icon: "🧠",
    tone: "purple",
    title: "Quiz arcade",
    sub: "Preguntas infinitas en solitario.",
  },
];

type Phase =
  | { status: "loading" }
  | { status: "no-group" }
  | { status: "error"; error: string }
  | { status: "purpose" }
  | { status: "games" }
  | { status: "saving" }
  | { status: "done" };

function OnboardingInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [phase, setPhase] = useState<Phase>({ status: "loading" });
  const [gid, setGid] = useState("");
  const [botName, setBotName] = useState<string | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  // Whether the serving bot is an admin in this group. When it is only a member
  // the moderation purposes (moderate / both) are disabled — they can't work.
  const [botIsAdmin, setBotIsAdmin] = useState(true);
  const [purpose, setPurpose] = useState<BotPurpose>("both");
  const [games, setGames] = useState<GameToggles>({
    tictactoe: true,
    rps: true,
    quiz: true,
    dailytrivia: true,
    boss: true,
  });
  const [cadence, setCadence] = useState<TriviaCadence>("daily");
  const [announce, setAnnounce] = useState(true);

  // Back arrow: from the games step return to the purpose question.
  useBackButton(
    phase.status === "games"
      ? () => setPhase({ status: "purpose" })
      : undefined,
  );

  useEffect(() => {
    ready();
    const sp = getStartParam();
    const decoded = decodeStartParam(sp);
    const fromQuery = search.get("gid");
    const resolvedGid =
      fromQuery ?? (decoded && "groupId" in decoded ? decoded.groupId : "");
    if (!resolvedGid) {
      setPhase({ status: "no-group" });
      return;
    }
    setGid(resolvedGid);
    Promise.all([postSession(sp), getGamesConfig(resolvedGid)])
      .then(([session, cfg]) => {
        const tpl = session.bot?.template ?? null;
        const admin = session.group?.botIsAdmin ?? true;
        setBotName(session.bot?.name ?? null);
        setTemplate(tpl);
        setBotIsAdmin(admin);
        // A member-only bot can only play, so default the pick to "play"; an
        // admin bot follows the template recommendation. A saved choice wins.
        const suggested = admin ? recommendedPurpose(tpl) : "play";
        setPurpose(cfg.configured ? cfg.purpose : suggested);
        setGames(cfg.games);
        setCadence(cfg.triviaCadence);
        setAnnounce(cfg.announce);
        setPhase({ status: "purpose" });
      })
      .catch((e: Error) =>
        setPhase({ status: "error", error: humanError(e.message) }),
      );
  }, [search]);

  const brand = botName ?? "el bot";

  const save = async (config: GamesConfig, after: "moderate" | "games") => {
    setPhase({ status: "saving" });
    try {
      await putGamesConfig(gid, config);
      haptic.notify("success");
      if (after === "moderate") {
        router.replace(`/config?gid=${gid}` as Route);
        return;
      }
      setPhase({ status: "done" });
    } catch (e) {
      setPhase({ status: "error", error: humanError((e as Error).message) });
    }
  };

  const choosePurpose = (next: BotPurpose) => {
    // Guard: moderation purposes require the bot to be admin. The rows are also
    // disabled in the UI, so this only defends against a stale click.
    if (!botIsAdmin && next !== "play") {
      return;
    }
    setPurpose(next);
    if (next === "moderate") {
      // Moderation-only: no chat noise, straight to the config hub after saving.
      void save(
        {
          purpose: next,
          games,
          triviaCadence: cadence,
          announce: false,
          configured: true,
        },
        "moderate",
      );
      return;
    }
    setPhase({ status: "games" });
  };

  const saveGames = () =>
    void save(
      { purpose, games, triviaCadence: cadence, announce, configured: true },
      "games",
    );

  if (phase.status === "loading" || phase.status === "saving") {
    return (
      <Screen>
        <AppHeader
          glyph="✨"
          tone="brand"
          title="Configuración inicial"
          subtitle={
            phase.status === "saving" ? "Guardando…" : "Preparando el grupo…"
          }
        />
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  if (phase.status === "no-group") {
    return (
      <Screen>
        <Empty
          icon="✨"
          tone="brand"
          title="Ábrelo desde tu grupo"
          hint="Añádeme a un grupo y pulsa el botón de configurar (o escribe /settings) para empezar."
        />
      </Screen>
    );
  }

  if (phase.status === "error") {
    return (
      <Screen>
        <AppHeader glyph="✨" tone="brand" title="Configuración inicial" />
        <Banner kind="error">{phase.error}</Banner>
      </Screen>
    );
  }

  if (phase.status === "done") {
    return (
      <Screen>
        <AppHeader
          glyph="🎉"
          tone="brand"
          title="¡Listo!"
          subtitle={`${brand} ya está configurado en este grupo.`}
        />
        <Banner kind="success">
          Guardado. Puedes cambiarlo cuando quieras.
        </Banner>
        <Section caption="Siguiente">
          <Group>
            <Row
              icon="🎮"
              tone="purple"
              title="Abrir juegos"
              subtitle="Mira cómo se ve el hub de juegos."
              chevron
              href={"/games" as Route}
            />
            {purpose === "both" && (
              <Row
                icon="🛡️"
                tone="blue"
                title="Configurar moderación"
                subtitle="Bienvenida, captcha, antiflood, locks…"
                chevron
                href={`/config?gid=${gid}` as Route}
              />
            )}
          </Group>
        </Section>
      </Screen>
    );
  }

  if (phase.status === "purpose") {
    // Without admin rights the bot can only play; recommend and allow just that.
    const recommended = botIsAdmin ? recommendedPurpose(template) : "play";
    const isLocked = (id: BotPurpose) => !botIsAdmin && id !== "play";
    // Recommended option first, the rest in their natural order.
    const ordered = [
      ...PURPOSE_OPTIONS.filter((o) => o.id === recommended),
      ...PURPOSE_OPTIONS.filter((o) => o.id !== recommended),
    ];
    return (
      <Screen>
        <AppHeader
          glyph="✨"
          tone="brand"
          title={`¿Para qué usarás ${brand}?`}
          subtitle="Lo ajusto todo según lo que elijas. Podrás cambiarlo luego."
        />
        {!botIsAdmin && (
          <Banner kind="info">
            Todavía no soy administrador de este grupo, así que de momento solo
            puedo jugar. Hazme admin para moderar, dar la bienvenida y activar
            el captcha; luego vuelve a abrir esto.
          </Banner>
        )}
        <Section caption="Elige un uso">
          <Group>
            {ordered.map((opt) => {
              const locked = isLocked(opt.id);
              return (
                <Row
                  key={opt.id}
                  icon={opt.icon}
                  tone={opt.tone}
                  title={opt.title}
                  subtitle={opt.sub}
                  chevron={!locked}
                  disabled={locked}
                  value={
                    locked ? (
                      <span className="board-points">🔒 Necesita admin</span>
                    ) : opt.id === recommended ? (
                      <span className="board-points">Recomendado</span>
                    ) : undefined
                  }
                  onClick={() => choosePurpose(opt.id)}
                />
              );
            })}
          </Group>
        </Section>
        <GroupNote>
          {!botIsAdmin
            ? "Cuando me hagas administrador podrás elegir también Administrar o Las dos."
            : template
              ? "Sugerencia basada en el tipo de este bot; puedes elegir cualquiera."
              : "Puedes elegir cualquiera de las tres opciones."}
        </GroupNote>
      </Screen>
    );
  }

  // phase.status === "games"
  const toggleGame = (key: keyof GameToggles, next: boolean) =>
    setGames((prev) => ({ ...prev, [key]: next }));

  return (
    <Screen>
      <AppHeader
        glyph="🎮"
        tone="purple"
        title="Juegos del grupo"
        subtitle="Activa lo que quieras ofrecer. Todo suma a la clasificación."
      />
      <Section caption="Juegos disponibles">
        <Group>
          {GAME_META.map((meta) => (
            <Row
              key={meta.key}
              icon={meta.icon}
              tone={meta.tone}
              title={meta.title}
              subtitle={meta.sub}
              trailing={
                <Toggle
                  checked={games[meta.key]}
                  label={meta.title}
                  onChange={(next) => toggleGame(meta.key, next)}
                />
              }
            />
          ))}
        </Group>
      </Section>

      {games.dailytrivia && (
        <Section caption="Trivia de comunidad">
          <Field
            label="Cada cuánto se publica una pregunta nueva"
            hint={
              cadence === "hourly"
                ? "Una pregunta distinta cada hora en punto."
                : "Una pregunta al día (00:00 UTC)."
            }
          >
            <Segmented<TriviaCadence>
              options={[
                { value: "daily", label: "Diaria" },
                { value: "hourly", label: "Cada hora" },
              ]}
              value={cadence}
              onChange={setCadence}
            />
          </Field>
          <Group>
            <Row
              icon="📣"
              tone="orange"
              title="Anunciar en el grupo"
              subtitle="Publico un aviso con botón cuando abra una trivia nueva."
              trailing={
                <Toggle
                  checked={announce}
                  label="Anunciar en el grupo"
                  onChange={setAnnounce}
                />
              }
            />
          </Group>
        </Section>
      )}

      <Button variant="primary" block onClick={saveGames}>
        Guardar
      </Button>
      {purpose === "both" && (
        <GroupNote>
          Después podrás configurar la moderación desde el menú de ajustes.
        </GroupNote>
      )}
    </Screen>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={3} />
        </Screen>
      }
    >
      <OnboardingInner />
    </Suspense>
  );
}
