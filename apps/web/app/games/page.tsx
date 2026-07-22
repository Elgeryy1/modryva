"use client";

import { useEffect, useRef, useState } from "react";
import { CoopBoss } from "../../components/games/coop-boss";
import { DailyTrivia } from "../../components/games/daily-trivia";
import { MathSprint } from "../../components/games/math-sprint";
import { MemoryGame } from "../../components/games/memory-game";
import { QuizArcade } from "../../components/games/quiz-arcade";
import { ReflexGame } from "../../components/games/reflex-game";
import { RpsGame } from "../../components/games/rps-game";
import { TicTacToe } from "../../components/games/tic-tac-toe";
import {
  AppHeader,
  Banner,
  Button,
  Empty,
  Group,
  GroupNote,
  Row,
  Screen,
  Section,
  type Tone,
  useBackButton,
} from "../../components/ui";
import {
  gamesLeaderboard,
  type LeaderboardRow,
  postSession,
  startGame,
  submitScore,
} from "../../lib/api";
import { decodeStartParam } from "../../lib/config-meta";
import {
  getStartParam,
  haptic,
  openTelegramLink,
  ready,
} from "../../lib/telegram";

interface GameMeta {
  id: string;
  title: string;
  desc: string;
  icon: string;
  tone: Tone;
}

// Grouped by feel: quick skill games up top, turn-based classics below.
const SKILL_GAMES: GameMeta[] = [
  {
    id: "reflex",
    title: "Reflejos",
    desc: "Toca cuando se ponga verde.",
    icon: "⚡",
    tone: "orange",
  },
  {
    id: "quiz-arcade",
    title: "Quiz Arcade",
    desc: "Preguntas infinitas del banco.",
    icon: "🧠",
    tone: "purple",
  },
  {
    id: "memory",
    title: "Parejas",
    desc: "Encuentra las 6 parejas.",
    icon: "🃏",
    tone: "blue",
  },
  {
    id: "math-sprint",
    title: "Cálculo Rápido",
    desc: "Resuelve todo lo que puedas en 30s.",
    icon: "➗",
    tone: "teal",
  },
];

const CLASSIC_GAMES: GameMeta[] = [
  {
    id: "tictactoe",
    title: "Tres en raya",
    desc: "Vence a Modryva. ❌ contra ⭕.",
    icon: "⭕",
    tone: "green",
  },
  {
    id: "rps",
    title: "Piedra, papel o tijera",
    desc: "Al mejor de 5 contra el bot.",
    icon: "✊",
    tone: "pink",
  },
];

type View =
  | { name: "hub" }
  | { name: "playing"; game: string; sessionId: string }
  | { name: "result"; points: number }
  | { name: "daily" }
  | { name: "boss" };

export default function GamesPage() {
  const [view, setView] = useState<View>({ name: "hub" });
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [scope, setScope] = useState<string>("personal");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const autoStarted = useRef(false);

  // Native back arrow returns to the hub from a game or the result screen.
  useBackButton(
    view.name === "hub" ? undefined : () => setView({ name: "hub" }),
  );

  const loadBoard = async () => {
    try {
      const result = await gamesLeaderboard();
      setRows(result.rows);
      setScope(result.scope);
    } catch {
      // leaderboard is best-effort
    }
  };

  const play = async (game: string) => {
    setError(null);
    setBusy(true);
    haptic.impact("light");
    try {
      const session = await startGame(game);
      setView({ name: "playing", game, sessionId: session.sessionId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  };

  const finish = async (sessionId: string, rawScore: number) => {
    let points = 0;
    try {
      const result = await submitScore(sessionId, rawScore);
      points = result.points;
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    }
    haptic.notify("success");
    setView({ name: "result", points });
    void loadBoard();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only bootstrap
  useEffect(() => {
    ready();
    void loadBoard();
    // Learn which bot we belong to so the portable "add me to your group" nudge
    // can deep-link back to it. Best-effort: the nudge degrades to plain text.
    void postSession(getStartParam())
      .then((session) => setBotUsername(session.bot?.username ?? null))
      .catch(() => {});
    const decoded = decodeStartParam(getStartParam());
    if (
      (decoded?.kind === "game" || decoded?.kind === "inlineGame") &&
      !autoStarted.current
    ) {
      autoStarted.current = true;
      if (decoded.game === "dailytrivia") {
        setView({ name: "daily" });
      } else if (decoded.game === "boss") {
        setView({ name: "boss" });
      } else {
        void play(decoded.game);
      }
    }
  }, []);

  if (view.name === "daily") {
    return <DailyTrivia onExit={() => setView({ name: "hub" })} />;
  }

  if (view.name === "boss") {
    return <CoopBoss onExit={() => setView({ name: "hub" })} />;
  }

  if (view.name === "playing") {
    const onFin = (raw: number) => void finish(view.sessionId, raw);
    return (
      <Screen>
        {view.game === "reflex" && <ReflexGame onFinish={onFin} />}
        {view.game === "quiz-arcade" && <QuizArcade onFinish={onFin} />}
        {view.game === "memory" && <MemoryGame onFinish={onFin} />}
        {view.game === "math-sprint" && <MathSprint onFinish={onFin} />}
        {view.game === "tictactoe" && <TicTacToe onFinish={onFin} />}
        {view.game === "rps" && <RpsGame onFinish={onFin} />}
      </Screen>
    );
  }

  if (view.name === "result") {
    return (
      <Screen>
        <div className="game-result">
          <span className="empty-icon tone-brand" aria-hidden="true">
            🎉
          </span>
          <h1>¡Bien jugado!</h1>
          <p className="game-points">+{view.points} puntos</p>
          {error && <Banner kind="error">{error}</Banner>}
          <Button
            type="button"
            variant="secondary"
            block
            onClick={() => setView({ name: "hub" })}
          >
            Volver a juegos
          </Button>
        </div>
        <PortableNudge scope={scope} botUsername={botUsername} />
        <Board rows={rows} scope={scope} />
      </Screen>
    );
  }

  const gameRow = (game: GameMeta) => (
    <Row
      key={game.id}
      icon={game.icon}
      tone={game.tone}
      title={game.title}
      subtitle={game.desc}
      chevron
      disabled={busy}
      onClick={() => void play(game.id)}
    />
  );

  return (
    <Screen>
      <AppHeader
        glyph="🎮"
        tone="purple"
        title="Juegos"
        subtitle="Juega, suma puntos y sube en la clasificación."
      />
      {error && <Banner kind="error">{error}</Banner>}
      <Section caption="Habilidad">
        <Group>{SKILL_GAMES.map(gameRow)}</Group>
      </Section>
      <Section caption="Clásicos">
        <Group>{CLASSIC_GAMES.map(gameRow)}</Group>
      </Section>
      <Section caption="Comunidad">
        <Group>
          <Row
            icon="🗓️"
            tone="green"
            title="Trivia diaria"
            subtitle="Una pregunta al día. Suma para tu grupo."
            chevron
            disabled={busy}
            onClick={() => setView({ name: "daily" })}
          />
          <Row
            icon="⚔️"
            tone="red"
            title="Boss cooperativo"
            subtitle="Todo el grupo derriba a un jefe. 1 ataque al día."
            chevron
            disabled={busy}
            onClick={() => setView({ name: "boss" })}
          />
        </Group>
      </Section>
      <Section caption="Apuestas">
        <Group>
          <Row
            icon="🎰"
            tone="orange"
            title="Casino"
            subtitle="Fichas virtuales, provably-fair."
            href="/casino"
            chevron
          />
        </Group>
      </Section>
      <PortableNudge scope={scope} botUsername={botUsername} />
      <Board rows={rows} scope={scope} />
    </Screen>
  );
}

/**
 * Portable growth nudge: solo play is free forever, but the social layer
 * (rankings, tournaments, co-op bosses) lives in a group. Shown only when the
 * player is on the global portable scoreboard — never nags in-group players.
 */
function PortableNudge({
  scope,
  botUsername,
}: {
  scope: string;
  botUsername: string | null;
}) {
  if (scope !== "portable") {
    return null;
  }
  return (
    <Section caption="Juega con tu comunidad">
      <Group>
        <Row
          icon="➕"
          tone="brand"
          title="Añade Modryva a tu grupo"
          subtitle="Desbloquea rankings, torneos y jefes con tus amigos."
        />
      </Group>
      {botUsername ? (
        <Button
          type="button"
          variant="secondary"
          block
          onClick={() =>
            openTelegramLink(`https://t.me/${botUsername}?startgroup=true`)
          }
        >
          ➕ Añadir a mi grupo
        </Button>
      ) : (
        <GroupNote>
          Si no eres admin, pídele a un administrador que me añada al grupo.
        </GroupNote>
      )}
    </Section>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_TONES: Tone[] = ["brand", "gray", "orange"];

function Board({ rows, scope }: { rows: LeaderboardRow[]; scope: string }) {
  return (
    <Section
      caption={
        <>
          Clasificación{" "}
          {scope === "group"
            ? "del grupo"
            : scope === "portable"
              ? "portable"
              : "personal"}
        </>
      }
    >
      {rows.length === 0 ? (
        <Empty
          icon="🏆"
          tone="brand"
          title="Aún no hay puntuaciones"
          hint="¡Sé el primero en marcar un récord!"
        />
      ) : (
        <Group>
          {rows.map((row, i) => (
            <Row
              key={row.telegramUserId}
              icon={i < 3 ? (MEDALS[i] ?? String(i + 1)) : String(i + 1)}
              tone={i < 3 ? (MEDAL_TONES[i] ?? "gray") : "gray"}
              title={row.name ?? row.telegramUserId}
              value={<span className="board-points">{row.points}</span>}
            />
          ))}
        </Group>
      )}
    </Section>
  );
}
