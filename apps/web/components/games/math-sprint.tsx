"use client";

import { useEffect, useRef, useState } from "react";

const DURATION = 30;
const rnd = (n: number) => Math.floor(Math.random() * n);

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = rnd(i + 1);
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
};

interface Problem {
  text: string;
  answer: number;
  options: number[];
}

const makeProblem = (): Problem => {
  const op = (["+", "-", "×"] as const)[rnd(3)] ?? "+";
  let a = rnd(12) + 1;
  let b = rnd(12) + 1;
  let answer: number;
  if (op === "-") {
    if (b > a) {
      const t = a;
      a = b;
      b = t;
    }
    answer = a - b;
  } else if (op === "×") {
    answer = a * b;
  } else {
    answer = a + b;
  }
  const options = new Set<number>([answer]);
  while (options.size < 4) {
    const cand = answer + (rnd(9) - 4);
    if (cand >= 0) {
      options.add(cand);
    }
  }
  return { text: `${a} ${op} ${b}`, answer, options: shuffle([...options]) };
};

/**
 * Math sprint: solve as many problems as possible in 30 seconds. Raw score is
 * the number of correct answers (capped at the catalog's maxRawScore of 20).
 */
export function MathSprint({ onFinish }: { onFinish: (raw: number) => void }) {
  const [problem, setProblem] = useState<Problem>(makeProblem);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const scoreRef = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          if (!done.current) {
            done.current = true;
            onFinish(Math.min(20, scoreRef.current));
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onFinish]);

  const answer = (choice: number) => {
    if (timeLeft <= 0) {
      return;
    }
    if (choice === problem.answer) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
    }
    setProblem(makeProblem());
  };

  return (
    <div className="game">
      <p className="game-progress">
        ⏱ {timeLeft}s · {score} aciertos
      </p>
      <h2 className="quiz-q">{problem.text} = ?</h2>
      <div className="quiz-options">
        {problem.options.map((opt) => (
          <button
            key={opt}
            type="button"
            className="quiz-option"
            onClick={() => answer(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
