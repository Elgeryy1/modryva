"use client";

import { type JSX, useCallback, useEffect, useState } from "react";
import { type WordleView, wordleBoard, wordleGuess } from "../../lib/api";
import { Banner, Section, SkeletonList } from "../ui";

/**
 * El wordle del grupo, con teclado.
 *
 * Se jugaba escribiendo la palabra en el chat. Se movio aqui porque en un
 * mensaje de Telegram no hay forma de pintar un teclado con las letras ya
 * descartadas en gris — y esa es la mitad de la ayuda que da un wordle.
 *
 * Lo que NO cambia: el tablero es del grupo. Seis intentos entre todos, y las
 * dos reglas de convivencia siguen vivas en el servidor. La de "no acapares"
 * aqui se ve, que en el chat era un mensaje que se perdia: el teclado se
 * bloquea y dice por que.
 */

const POLL_MS = 3000;

const MARK_BG: Record<string, string> = {
  hit: "#3f9d55",
  present: "#d8a72f",
  miss: "#4a4a52",
};

const ROWS = ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"];

const ERROR_TEXT: Record<string, string> = {
  "wrong-length": "Tiene que ser de 5 letras.",
  "not-a-word": "Solo letras, sin números ni signos.",
  "already-tried": "Esa ya la habéis probado.",
  hogging: "Deja tirar a alguien más antes de repetir.",
  finished: "La partida ya terminó.",
  "stale-board":
    "Alguien jugó mientras escribías. Ya tienes el tablero al día.",
};

const errorTextOf = (error: unknown): string => {
  const code =
    typeof error === "object" && error !== null
      ? ((error as { body?: { error?: unknown } }).body?.error ?? null)
      : null;
  return typeof code === "string" && ERROR_TEXT[code]
    ? (ERROR_TEXT[code] as string)
    : "No se pudo enviar. Inténtalo otra vez.";
};

function Cell({
  letter,
  mark,
}: {
  letter: string;
  mark?: "hit" | "present" | "miss" | undefined;
}): JSX.Element {
  return (
    <div
      style={{
        alignItems: "center",
        background: mark ? MARK_BG[mark] : "transparent",
        border: mark ? "none" : "2px solid rgba(128,128,128,.45)",
        borderRadius: 6,
        color: mark ? "#fff" : "inherit",
        display: "flex",
        fontSize: "1.5rem",
        fontWeight: 700,
        height: 48,
        justifyContent: "center",
        width: 48,
      }}
    >
      {letter}
    </div>
  );
}

export function WordleBoard({ matchId }: { matchId: string }): JSX.Element {
  const [view, setView] = useState<WordleView | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setView(await wordleBoard(matchId));
    } catch {
      setFatal(true);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (view?.finished) {
      return;
    }
    const timer = setInterval(() => {
      // No se refresca con algo a medio escribir: cambiar el tablero debajo de
      // quien esta tecleando le hace perder lo que llevaba.
      if (!busy && draft.length === 0) {
        void load();
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load, busy, draft.length, view?.finished]);

  if (fatal) {
    return <Banner kind="error">No he podido cargar la partida.</Banner>;
  }
  if (!view) {
    return <SkeletonList rows={4} />;
  }

  const enviar = async () => {
    if (draft.length !== view.wordLength || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setView(await wordleGuess(matchId, draft, view.version));
      setDraft("");
    } catch (e) {
      setError(errorTextOf(e));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const pulsar = (ch: string) => {
    if (!view.canGuess || busy) {
      return;
    }
    setError(null);
    setDraft((d) => (d.length >= view.wordLength ? d : d + ch));
  };

  // La rejilla completa, con coordenadas propias.
  //
  // Se construye entera de una vez en vez de pintar tres trozos con el indice
  // de cada `map` como clave: en un tablero, la identidad de una celda ES su
  // fila y su columna, y decirlo asi deja las claves estables cuando la fila de
  // borrador se convierte en un intento y todo lo de abajo sube una posicion.
  const vacias = Math.max(
    0,
    view.attemptsLeft - (view.canGuess && !view.finished ? 1 : 0),
  );
  const filas: {
    id: string;
    celdas: {
      id: string;
      letter: string;
      mark?: "hit" | "present" | "miss" | undefined;
    }[];
  }[] = [];
  const fila = (
    id: string,
    letras: string,
    marks?: WordleView["attempts"][number]["marks"],
  ) => {
    filas.push({
      id,
      celdas: Array.from({ length: view.wordLength }, (_, col) => ({
        id: `${id}:${col}`,
        letter: letras[col] ?? "",
        ...(marks?.[col] ? { mark: marks[col] } : {}),
      })),
    });
  };
  view.attempts.forEach((a, n) => {
    fila(`try${n}`, a.word, a.marks);
  });
  if (view.canGuess && !view.finished) {
    fila("draft", draft);
  }
  for (let r = 0; r < vacias; r += 1) {
    fila(`empty${r}`, "");
  }

  return (
    <>
      {view.finished ? (
        <Banner kind={view.solved ? "success" : "error"}>
          {view.solved ? "✅ ¡Acertada!" : "❌ Se acabaron los intentos."} Era{" "}
          <b>{view.answer}</b>.
        </Banner>
      ) : null}
      {error ? <Banner kind="error">{error}</Banner> : null}
      {!view.finished && view.blockedReason === "hogging" ? (
        <Banner kind="info">
          Has tirado dos veces seguidas. Deja probar a alguien más.
        </Banner>
      ) : null}

      <Section
        caption={`${view.attemptsLeft}/6 intentos · los seis son de todo el grupo`}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "center",
          }}
        >
          {filas.map((f) => (
            <div key={f.id} style={{ display: "flex", gap: 6 }}>
              {f.celdas.map((c) => (
                <Cell key={c.id} letter={c.letter} mark={c.mark} />
              ))}
            </div>
          ))}
        </div>
      </Section>

      {view.finished ? null : (
        <Section caption="Teclado">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ROWS.map((row) => (
              <div
                key={row}
                style={{ display: "flex", gap: 4, justifyContent: "center" }}
              >
                {row.split("").map((ch) => (
                  <button
                    disabled={!view.canGuess || busy}
                    key={ch}
                    onClick={() => pulsar(ch)}
                    style={{
                      background: view.letters[ch]
                        ? MARK_BG[view.letters[ch] as string]
                        : "rgba(128,128,128,.22)",
                      border: "none",
                      borderRadius: 5,
                      color: view.letters[ch] ? "#fff" : "inherit",
                      flex: "1 1 0",
                      fontWeight: 700,
                      minWidth: 0,
                      opacity: view.canGuess ? 1 : 0.5,
                      padding: "12px 0",
                    }}
                    type="button"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button
                disabled={draft.length === 0 || busy}
                onClick={() => setDraft((d) => d.slice(0, -1))}
                style={{
                  background: "rgba(128,128,128,.22)",
                  border: "none",
                  borderRadius: 6,
                  flex: 1,
                  fontWeight: 700,
                  padding: "14px 0",
                }}
                type="button"
              >
                ⌫ Borrar
              </button>
              <button
                disabled={draft.length !== view.wordLength || busy}
                onClick={() => void enviar()}
                style={{
                  background:
                    draft.length === view.wordLength
                      ? MARK_BG.hit
                      : "rgba(128,128,128,.22)",
                  border: "none",
                  borderRadius: 6,
                  color: draft.length === view.wordLength ? "#fff" : "inherit",
                  flex: 2,
                  fontWeight: 700,
                  padding: "14px 0",
                }}
                type="button"
              >
                Probar
              </button>
            </div>
          </div>
        </Section>
      )}
    </>
  );
}
