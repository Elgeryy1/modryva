"use client";

import { useEffect, useRef, useState } from "react";
import { type QuizBatchQuestion, quizBatch } from "../../lib/api";

const ROUND_KEY = "quiz-arcade-round";

// Reads the next round counter (session-scoped) and advances it, so replaying
// the arcade serves fresh questions from the 5000+ bank instead of the same 8.
const nextRound = (): number => {
  if (typeof window === "undefined") {
    return 0;
  }
  const stored = Number(window.sessionStorage.getItem(ROUND_KEY) ?? "0");
  const round = Number.isFinite(stored) ? stored : 0;
  window.sessionStorage.setItem(ROUND_KEY, String(round + 1));
  return round;
};

/**
 * Arcade quiz over the full trivia bank: each play pulls a fresh batch (server
 * caps the submitted score, so the batch stays at 8). +1 per correct answer;
 * raw score is the number correct. Calls onFinish(rawScore) after the last one.
 */
export function QuizArcade({
  onFinish,
}: {
  onFinish: (rawScore: number) => void;
}) {
  const [questions, setQuestions] = useState<QuizBatchQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [locked, setLocked] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) {
      return;
    }
    loaded.current = true;
    quizBatch(nextRound())
      .then((res) => setQuestions(res.questions))
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "No pude cargar las preguntas.",
        ),
      );
  }, []);

  if (error) {
    return (
      <div className="game">
        <p className="game-progress">{error}</p>
      </div>
    );
  }

  if (!questions) {
    return (
      <div className="game">
        <p className="game-progress">Cargando preguntas…</p>
      </div>
    );
  }

  const question = questions[index];
  if (!question) {
    return null;
  }

  const answer = (choice: number) => {
    if (locked) {
      return;
    }
    setLocked(true);
    setPicked(choice);
    const correct = choice === question.correctIndex;
    const nextScore = correct ? score + 1 : score;
    setScore(nextScore);
    setTimeout(() => {
      const next = index + 1;
      if (next >= questions.length) {
        onFinish(nextScore);
      } else {
        setIndex(next);
        setLocked(false);
        setPicked(null);
      }
    }, 700);
  };

  return (
    <div className="game">
      <p className="game-progress">
        Pregunta {index + 1}/{questions.length} · {score} aciertos
      </p>
      <h3 className="quiz-q">{question.question}</h3>
      <div className="quiz-options">
        {question.options.map((option, choice) => {
          const state =
            picked === null
              ? ""
              : choice === question.correctIndex
                ? " ok"
                : choice === picked
                  ? " bad"
                  : "";
          return (
            <button
              key={option}
              type="button"
              className={`quiz-option${state}`}
              disabled={locked}
              onClick={() => answer(choice)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
