"use client";

// Lo que solo puede ver una persona de una partida de grupo: su palabra en El
// Impostor, su mano de cartas. El chat enseña lo público; esta pantalla existe
// porque un grupo de Telegram no tiene ningún canal privado.

import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import {
  type MatchPlayer,
  type MatchSecretView,
  matchSecret,
} from "../../lib/api";
import { roleCopyOf } from "../../lib/impostor-role";
import { Banner, Group, GroupNote, Section, SkeletonList } from "../ui";

/**
 * Cada cuánto se vuelve a preguntar.
 *
 * Más despacio que el tablero de tres en raya (2 s) porque esto casi nunca
 * cambia: tu palabra no cambia en toda la partida y tu mano solo cuando te toca
 * a ti. Lo que sí cambia es quién sigue vivo, y para eso seis segundos sobran.
 */
const POLL_MS = 6000;

/** Lo que trae `secret` en El Impostor. */
interface ImpostorSecret {
  role?: string;
  word?: string;
}

/** Lo que trae `secret` en las cartas de colores. */
interface CardsSecret {
  hand?: string[];
}

const COLOR_GLYPH: Record<string, string> = {
  R: "🔴",
  Y: "🟡",
  G: "🟢",
  B: "🔵",
};

const FACE_NAME: Record<string, string> = {
  s: "salta",
  r: "cambio",
  d: "+2",
};

/**
 * Una carta legible.
 *
 * El mismo criterio que en el chat: una carta es un texto corto ("R5", "W4") y
 * pintarla es traducirlo. Si esto y el bot dibujaran distinto, la mano de la
 * pantalla y la del grupo parecerían dos barajas.
 */
const renderCard = (card: string): string => {
  if (card === "W") {
    return "🌈 comodín";
  }
  if (card === "W4") {
    return "🌈 +4";
  }
  const glyph = COLOR_GLYPH[card[0] ?? ""] ?? "⬜";
  const face = card.slice(1);
  return `${glyph} ${FACE_NAME[face] ?? face}`;
};

const isImpostorSecret = (value: unknown): value is ImpostorSecret =>
  typeof value === "object" && value !== null && "role" in value;

const isCardsSecret = (value: unknown): value is CardsSecret =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as CardsSecret).hand);

export function PrivateHand({ matchId }: { matchId: string }): JSX.Element {
  const [view, setView] = useState<MatchSecretView | null>(null);
  const [error, setError] = useState<string | null>(null);
  // En un ref para que el efecto de sondeo no se resuscriba en cada cambio.
  const live = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await matchSecret(matchId);
      if (live.current) {
        setView(next);
        setError(null);
      }
    } catch {
      if (live.current) {
        setError("No he podido cargar tu parte de la partida.");
      }
    }
  }, [matchId]);

  useEffect(() => {
    live.current = true;
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => {
      live.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  if (error) {
    return <Banner kind="error">{error}</Banner>;
  }
  if (!view) {
    return <SkeletonList rows={3} />;
  }

  // `secret` en null tiene dos causas —no juegas esa partida, o esa partida no
  // existe— y el servidor no las distingue a propósito. Aquí tampoco: decir
  // cuál de las dos es dejaría enumerar partidas probando enlaces.
  if (view.secret === null) {
    return (
      <Group>
        <GroupNote>
          No estás en esta partida. Si acabas de apuntarte, espera a que
          empiece.
        </GroupNote>
      </Group>
    );
  }

  return (
    <div>
      {isImpostorSecret(view.secret) ? (
        <ImpostorCard secret={view.secret} />
      ) : null}
      {isCardsSecret(view.secret) ? <HandCard secret={view.secret} /> : null}
      <Roster players={view.players ?? []} />
      <GroupNote>
        Esto solo lo ves tú. Nadie más del grupo puede abrir esta pantalla con
        tus datos.
      </GroupNote>
    </div>
  );
}

/**
 * El rol y la palabra.
 *
 * El rol va PRIMERO y en grande. Antes la pantalla era idéntica para todos —el
 * mismo título, la misma palabra enorme— y lo único que cambiaba era una línea
 * de letra pequeña debajo. Resultado: el impostor abría, leía su palabra, y
 * jugaba sin enterarse de que era el impostor. El dato estaba bien; el que no
 * se leía era el aviso.
 *
 * Por eso las dos pantallas ahora se distinguen de un vistazo, sin leer: color
 * distinto, título distinto y la palabra etiquetada como lo que es en cada
 * caso.
 */
function ImpostorCard({ secret }: { secret: ImpostorSecret }): JSX.Element {
  const copy = roleCopyOf(secret.role);
  return (
    <Section caption={copy.caption}>
      <Banner kind={copy.kind}>
        {copy.kind === "error" ? "🕵️ " : "🟢 "}
        <b>{copy.headline}</b>
      </Banner>
      <Group>
        <p
          style={{
            fontSize: "0.8rem",
            margin: "0.75rem 0 0",
            opacity: 0.7,
            textTransform: "uppercase",
          }}
        >
          {copy.wordLabel}
        </p>
        <p style={{ fontSize: "2rem", fontWeight: 700, margin: "0.25rem 0" }}>
          {secret.word ?? "—"}
        </p>
      </Group>
      <GroupNote>{copy.hint}</GroupNote>
      <GroupNote>
        Escribe tu pista en el chat del grupo con <b>/pista</b> y la palabra.
      </GroupNote>
    </Section>
  );
}

function HandCard({ secret }: { secret: CardsSecret }): JSX.Element {
  const mano = secret.hand ?? [];
  // Una mano PUEDE llevar dos cartas idénticas: la baraja trae dos de casi
  // todo. La clave numera las repeticiones ("R5#0", "R5#1") en vez de usar la
  // posición: así el segundo cinco rojo sigue siendo el segundo cinco rojo
  // aunque se tire una carta de antes y todo lo demás se desplace.
  const vistas = new Map<string, number>();
  const conClave = mano.map((card) => {
    const n = vistas.get(card) ?? 0;
    vistas.set(card, n + 1);
    return { card, key: `${card}#${n}` };
  });

  return (
    <Section caption={`Tu mano (${mano.length})`}>
      <Group>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {conClave.map(({ card, key }) => (
            <li key={key} style={{ padding: "0.35rem 0" }}>
              {renderCard(card)}
            </li>
          ))}
        </ul>
        {mano.length === 0 ? <GroupNote>Sin cartas.</GroupNote> : null}
      </Group>
    </Section>
  );
}

function Roster({ players }: { players: MatchPlayer[] }): JSX.Element | null {
  if (players.length === 0) {
    return null;
  }
  return (
    <Section caption="En la mesa">
      <Group>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {players.map((p) => (
            <li key={p.id} style={{ padding: "0.25rem 0" }}>
              {p.status === "alive" ? "🟢" : "⚫"} {p.name ?? "Alguien"}
            </li>
          ))}
        </ul>
      </Group>
    </Section>
  );
}
