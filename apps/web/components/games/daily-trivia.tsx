"use client";

import { useEffect, useState } from "react";
import {
  answerDailyTrivia,
  type DailyTrivia as DailyTriviaData,
  dailyTrivia,
} from "../../lib/api";
import { haptic } from "../../lib/telegram";
import {
  AppHeader,
  Banner,
  Empty,
  Group,
  Row,
  Screen,
  Section,
  SkeletonList,
  type Tone,
  useBackButton,
} from "../ui";

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_TONES: Tone[] = ["brand", "gray", "orange"];

/**
 * Trivia diaria de comunidad: a single question that is the same for everyone in
 * the group all day, answerable once. A correct answer adds points to the group
 * leaderboard. The correct option is revealed only after the player commits.
 */
export function DailyTrivia({ onExit }: { onExit: () => void }) {
  const [data, setData] = useState<DailyTriviaData | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useBackButton(onExit);

  const load = async () => {
    try {
      const fresh = await dailyTrivia();
      setData(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only load
  useEffect(() => {
    void load();
  }, []);

  const answer = async (index: number) => {
    if (busy || !data || data.answered || picked !== null) {
      return;
    }
    setBusy(true);
    setPicked(index);
    haptic.impact("light");
    try {
      const res = await answerDailyTrivia(index);
      haptic.notify(res.correct ? "success" : "error");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      setPicked(null);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Screen>
        <Banner kind="error">{error}</Banner>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <AppHeader glyph="🗓️" tone="green" title="Trivia diaria" />
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  const revealed = data.answered || picked !== null;
  const correct = data.correctIndex;
  const optionState = (index: number): string => {
    if (!revealed || correct === null) {
      return "";
    }
    if (index === correct) {
      return " ok";
    }
    if (index === picked) {
      return " bad";
    }
    return "";
  };

  return (
    <Screen>
      <AppHeader
        glyph="🗓️"
        tone="green"
        title="Trivia diaria"
        subtitle={
          data.scope === "group"
            ? "Una pregunta al día para todo el grupo."
            : "Una pregunta nueva cada día."
        }
      />

      <div className="game">
        <h3 className="quiz-q">{data.question.question}</h3>
        <div className="quiz-options">
          {data.question.options.map((option, index) => (
            <button
              key={option}
              type="button"
              className={`quiz-option${optionState(index)}`}
              disabled={busy || revealed}
              onClick={() => void answer(index)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {revealed && (
        <Banner kind={data.yourAnswerCorrect ? "success" : "info"}>
          {data.answered
            ? data.yourAnswerCorrect
              ? "¡Acertaste hoy! +2 puntos. Vuelve mañana. 👋"
              : "Hoy no fue. Vuelve mañana para otra. 👋"
            : "Respuesta registrada."}
        </Banner>
      )}

      <Section
        caption={`Hoy · ${data.participants} jugando · ${data.correctCount} aciertos`}
      >
        {data.board.length === 0 ? (
          <Empty
            icon="🏆"
            tone="brand"
            title="Aún no hay puntuaciones"
            hint="¡Sé el primero en acertar!"
          />
        ) : (
          <Group>
            {data.board.map((row, i) => (
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
    </Screen>
  );
}
