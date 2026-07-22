"use client";

import { useEffect, useMemo, useState } from "react";

const EMOJIS = ["🍎", "🚀", "🎩", "🐬", "🎸", "🔥"]; // 6 pairs

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
};

/**
 * Memory pairs: flip cards two at a time to find all 6 pairs. Raw score (0..100)
 * rewards fewer moves (perfect memory = 6 moves).
 */
export function MemoryGame({ onFinish }: { onFinish: (raw: number) => void }) {
  const cards = useMemo(
    () =>
      shuffle(EMOJIS.flatMap((emoji) => [emoji, emoji])).map((emoji, id) => ({
        id,
        emoji,
      })),
    [],
  );
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [lock, setLock] = useState(false);

  const flip = (id: number) => {
    if (lock || flipped.includes(id) || matched.includes(id)) {
      return;
    }
    const next = [...flipped, id];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      setLock(true);
      const [a, b] = next;
      const isMatch = cards[a as number]?.emoji === cards[b as number]?.emoji;
      setTimeout(() => {
        if (isMatch) {
          setMatched((m) => [...m, a as number, b as number]);
        }
        setFlipped([]);
        setLock(false);
      }, 650);
    }
  };

  useEffect(() => {
    if (cards.length > 0 && matched.length === cards.length) {
      const raw = Math.max(0, Math.min(100, 100 - (moves - EMOJIS.length) * 7));
      const t = setTimeout(() => onFinish(raw), 400);
      return () => clearTimeout(t);
    }
  }, [matched, cards.length, moves, onFinish]);

  return (
    <div className="game">
      <p className="game-progress">
        Movimientos: {moves} · {matched.length / 2}/{EMOJIS.length} parejas
      </p>
      <div className="memory-grid">
        {cards.map((card) => {
          const shown = flipped.includes(card.id) || matched.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              className={`memory-card${shown ? " up" : ""}`}
              onClick={() => flip(card.id)}
            >
              {shown ? card.emoji : "❓"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
