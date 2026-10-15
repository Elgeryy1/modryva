"use client";

import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import {
  type CardsTableView,
  cardsDraw,
  cardsPlay,
  cardsTable,
} from "../../lib/api";
import { Banner, Button, Group, Section, SkeletonList } from "../ui";
import {
  CARD_COLOR_LABEL,
  CARD_PALETTE,
  CardBack,
  type CardColor,
  CardFace,
  cardLabel,
  isWildCard,
} from "./card-face";

/**
 * La mesa de cartas de colores.
 *
 * Es la unica pantalla del proyecto donde se JUEGA, no donde se mira: el resto
 * de juegos viven en el chat, con botones en el mensaje del grupo. Este no
 * puede, por dos motivos que se dan a la vez — una mano de siete cartas no cabe
 * en un teclado de Telegram, y ademas solo la puede ver una persona.
 *
 * Lo que se ve aqui es la mesa entera y TU mano. La de los demas es un numero.
 */

/** Cada cuanto se pregunta por la mesa cuando no es tu turno. */
const POLL_MS = 3000;

const ERROR_TEXT: Record<string, string> = {
  "not-your-turn": "No es tu turno.",
  "not-playable": "Esa carta no encaja.",
  "not-in-hand": "Esa carta ya no está en tu mano.",
  "color-required": "Elige un color.",
  "match-over": "La partida ya terminó.",
  "stale-table": "La mesa cambió mientras decidías. Ya la tienes al día.",
  "not-a-player": "No estás en esta partida.",
  "match-gone": "Esta partida ya no existe.",
};

const errorTextOf = (error: unknown): string => {
  const code =
    typeof error === "object" && error !== null
      ? ((error as { body?: { error?: unknown } }).body?.error ?? null)
      : null;
  return typeof code === "string" && ERROR_TEXT[code]
    ? (ERROR_TEXT[code] as string)
    : "No se pudo jugar. Inténtalo otra vez.";
};

function ColorPicker({
  onPick,
  onCancel,
}: {
  onPick: (color: CardColor) => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <Section caption="¿A qué color lo cambias?">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(Object.keys(CARD_PALETTE) as CardColor[]).map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            style={{
              background: CARD_PALETTE[c].base,
              border: "none",
              borderRadius: 10,
              color: "#fff",
              cursor: "pointer",
              flex: "1 1 40%",
              fontWeight: 700,
              minHeight: 48,
            }}
            type="button"
          >
            {CARD_COLOR_LABEL[c]}
          </button>
        ))}
      </div>
      <Button onClick={onCancel} variant="secondary">
        Cancelar
      </Button>
    </Section>
  );
}

export function CardsTable({ matchId }: { matchId: string }): JSX.Element {
  const [view, setView] = useState<CardsTableView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Una jugada en vuelo no debe ser pisada por la respuesta de un sondeo que
  // salio antes: sin esto, la mesa "vuelve atras" sola durante un instante.
  const enVuelo = useRef(0);

  const load = useCallback(async () => {
    const sello = enVuelo.current;
    try {
      const next = await cardsTable(matchId);
      if (sello === enVuelo.current) {
        setView(next);
      }
    } catch {
      setFatal(true);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const miTurno =
    view?.seat !== null &&
    view?.seat !== undefined &&
    view.table?.turnSeat === view.seat &&
    !view.table?.finished;

  useEffect(() => {
    // Sondear solo mientras la partida sigue. Una mesa terminada no cambia, y
    // seguir preguntando por ella es gastar bateria por nada.
    if (view?.table?.finished) {
      return;
    }
    const timer = setInterval(() => {
      if (!busy) {
        void load();
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load, busy, view?.table?.finished]);

  const jugar = async (card: string, color?: CardColor) => {
    if (!view || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    enVuelo.current += 1;
    try {
      setView(await cardsPlay(matchId, card, view.version, color));
      setPending(null);
    } catch (e) {
      setError(errorTextOf(e));
      // Sea cual sea el motivo, la mesa que se ve ya no es de fiar: se recarga
      // para que el siguiente intento salga de algo cierto.
      await load();
    } finally {
      setBusy(false);
    }
  };

  const robar = async () => {
    if (!view || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    enVuelo.current += 1;
    try {
      setView(await cardsDraw(matchId, view.version));
    } catch (e) {
      setError(errorTextOf(e));
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (fatal) {
    return <Banner kind="error">No he podido cargar la partida.</Banner>;
  }
  if (!view?.table) {
    return <SkeletonList rows={4} />;
  }

  const { table } = view;
  const jugables = new Set(view.playable);
  const nombreDe = (seat: number) =>
    view.players.find((p) => p.seat === seat)?.name ?? `Asiento ${seat}`;

  // Una mano lleva cartas repetidas —dos "R5" son normales— asi que la carta
  // sola no vale como clave. Se numera cada repeticion: el segundo "R5" es
  // "R5#2". El indice del array no sirve, porque al tirar una carta del medio
  // todas las siguientes cambiarian de clave y React las repintaria enteras.
  const vistas = new Map<string, number>();
  const mano = view.hand.map((card) => {
    const n = (vistas.get(card) ?? 0) + 1;
    vistas.set(card, n);
    return { card, key: `${card}#${n}` };
  });

  return (
    <>
      {table.finished ? (
        <Banner kind="success">
          {table.winner === null
            ? "Partida terminada."
            : `🏆 Gana ${nombreDe(table.winner)}`}
        </Banner>
      ) : null}
      {error ? <Banner kind="error">{error}</Banner> : null}

      <Section caption="La mesa">
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 16,
            justifyContent: "center",
            padding: "8px 0",
          }}
        >
          <CardBack width={70} />
          <CardFace card={table.top} width={90} />
        </div>
        <p style={{ margin: 0, textAlign: "center" }}>
          Color en juego: <b>{CARD_COLOR_LABEL[table.activeColor]}</b>
          {table.pendingDraw > 0 ? ` · ⚠️ +${table.pendingDraw} pendientes` : ""}
        </p>
      </Section>

      <Section caption="Quién va">
        <Group>
          {table.seats.map((s) => (
            <div
              key={s}
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 12px",
                fontWeight: s === table.turnSeat ? 700 : 400,
              }}
            >
              <span>
                {s === table.turnSeat ? "▶️ " : ""}
                {nombreDe(s)}
                {s === view.seat ? " (tú)" : ""}
              </span>
              <span>{table.handSizes[s] ?? 0} cartas</span>
            </div>
          ))}
        </Group>
      </Section>

      {view.seat === null ? (
        <Banner kind="info">
          Estás mirando: no juegas esta partida, así que no ves la mano de
          nadie.
        </Banner>
      ) : (
        <Section
          caption={
            table.finished
              ? "Tu mano"
              : miTurno
                ? "Te toca — pulsa una carta"
                : `Espera a ${nombreDe(table.turnSeat)}`
          }
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              justifyContent: "center",
            }}
          >
            {mano.map(({ card, key }) => {
              const puede = miTurno && jugables.has(card);
              return (
                <button
                  aria-label={cardLabel(card)}
                  disabled={!puede || busy}
                  key={key}
                  onClick={() =>
                    isWildCard(card) ? setPending(card) : void jugar(card)
                  }
                  style={{
                    background: "none",
                    border: "none",
                    cursor: puede ? "pointer" : "default",
                    padding: 0,
                  }}
                  type="button"
                >
                  <CardFace
                    card={card}
                    dimmed={!puede && !table.finished}
                    selected={pending === card}
                    width={58}
                  />
                </button>
              );
            })}
          </div>

          {pending ? (
            <ColorPicker
              onCancel={() => setPending(null)}
              onPick={(c) => void jugar(pending, c)}
            />
          ) : null}

          {miTurno && !pending ? (
            <Button disabled={busy} onClick={() => void robar()}>
              {table.pendingDraw > 0
                ? `Robar ${table.pendingDraw}`
                : "Robar una"}
            </Button>
          ) : null}
        </Section>
      )}
    </>
  );
}
