"use client";

import type { JSX } from "react";

/**
 * Una carta, dibujada.
 *
 * En SVG y no como imagen a proposito. Una baraja son 108 cartas: servirlas
 * como PNG son varios megas en una app que se abre desde el movil y dentro de
 * Telegram, y ademas se ven borrosas en cuanto la pantalla tiene mas densidad
 * de la prevista. Aqui son cuatro formas —rectangulo, ovalo, numero y esquinas—
 * que pesan lo que ocupa este fichero y salen nitidas a cualquier tamaño.
 *
 * El otro motivo es que la baraja de la que salio la idea es la de UNO, que es
 * una marca de Mattel. El juego se llama "cartas de colores" justamente para no
 * meterse ahi; copiar la imagen de las cartas habria sido meterse igual, y en
 * un repositorio publico.
 */

/** Los cuatro colores, en claro y en oscuro. */
const PALETTE = {
  R: { base: "#e4463c", dark: "#c0362d" },
  Y: { base: "#f0a92b", dark: "#cf8c17" },
  G: { base: "#3f9d55", dark: "#2f7f42" },
  B: { base: "#3f6fd8", dark: "#2f57b2" },
} as const;

export type CardColor = keyof typeof PALETTE;

const COLOR_LABEL: Record<CardColor, string> = {
  R: "rojo",
  Y: "amarillo",
  G: "verde",
  B: "azul",
};

const FACE_LABEL: Record<string, string> = {
  s: "salta",
  r: "cambio de sentido",
  d: "roba dos",
};

/** El color de una carta, o null si es comodin. */
export const colorOfCard = (card: string): CardColor | null =>
  card.length > 1 && card[0] && card[0] in PALETTE
    ? (card[0] as CardColor)
    : null;

export const isWildCard = (card: string): boolean =>
  card === "W" || card === "W4";

/** Lo que se lee en el centro: el numero, o el simbolo de la figura. */
const centerGlyph = (face: string): string => {
  if (face === "s") {
    return "⊘";
  }
  if (face === "r") {
    return "⇄";
  }
  if (face === "d") {
    return "+2";
  }
  return face;
};

/** Lo que se dice en voz alta. Un lector de pantalla no ve el ovalo. */
export const cardLabel = (card: string): string => {
  if (card === "W") {
    return "comodín";
  }
  if (card === "W4") {
    return "comodín roba cuatro";
  }
  const color = colorOfCard(card);
  const face = card.slice(1);
  const nombre = FACE_LABEL[face] ?? face;
  return color ? `${nombre} ${COLOR_LABEL[color]}` : nombre;
};

const CORNERS = [
  { x: 9, y: 15, anchor: "start" as const, rotate: 0 },
  { x: 91, y: 135, anchor: "end" as const, rotate: 180 },
];

/**
 * Los cuatro cuartos de color del comodin. Se dibuja el mismo cuadrante cuatro
 * veces girado en vez de cuatro rutas distintas: una sola forma que mantener.
 */
function WildQuarters({ r = 30 }: { r?: number }): JSX.Element {
  const colores: CardColor[] = ["R", "B", "Y", "G"];
  return (
    <g transform="translate(50 75)">
      {colores.map((c, i) => (
        <path
          d={`M0 0 L${r} 0 A${r} ${r} 0 0 1 0 ${r} Z`}
          fill={PALETTE[c].base}
          key={c}
          transform={`rotate(${i * 90})`}
        />
      ))}
    </g>
  );
}

export interface CardFaceProps {
  readonly card: string;
  /** Ancho en px. La altura sale de la proporcion 100×150. */
  readonly width?: number;
  /** Apagada: no se puede tirar ahora. */
  readonly dimmed?: boolean;
  readonly selected?: boolean;
}

export function CardFace({
  card,
  width = 64,
  dimmed = false,
  selected = false,
}: CardFaceProps): JSX.Element {
  const color = colorOfCard(card);
  const wild = isWildCard(card);
  const face = card.slice(1);
  const glyph = wild ? (card === "W4" ? "+4" : "") : centerGlyph(face);
  const fondo = color ? PALETTE[color] : null;

  return (
    <svg
      aria-label={cardLabel(card)}
      height={width * 1.5}
      role="img"
      style={{
        display: "block",
        opacity: dimmed ? 0.4 : 1,
        transform: selected ? "translateY(-10px)" : undefined,
        transition: "transform 120ms ease, opacity 120ms ease",
        filter: selected
          ? "drop-shadow(0 4px 10px rgba(0,0,0,.35))"
          : undefined,
      }}
      viewBox="0 0 100 150"
      width={width}
    >
      <rect
        fill={fondo ? fondo.base : "#1b1b1f"}
        height={148}
        rx={12}
        stroke="#ffffff"
        strokeWidth={4}
        width={98}
        x={1}
        y={1}
      />
      {/* El óvalo inclinado: es lo que hace que una carta se lea como carta. */}
      <ellipse
        cx={50}
        cy={75}
        fill={wild ? "#111114" : "#ffffff"}
        rx={30}
        ry={46}
        transform="rotate(-20 50 75)"
      />
      {wild ? <WildQuarters /> : null}
      {glyph ? (
        <text
          fill={wild ? "#ffffff" : (fondo?.base ?? "#111")}
          fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
          fontSize={glyph.length > 1 ? 34 : 52}
          fontWeight={800}
          textAnchor="middle"
          x={50}
          y={94}
        >
          {glyph}
        </text>
      ) : null}
      {CORNERS.map((c) => (
        <text
          fill="#ffffff"
          fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
          fontSize={18}
          fontWeight={700}
          key={`${c.x}-${c.y}`}
          textAnchor={c.anchor}
          transform={c.rotate ? `rotate(180 ${c.x} ${c.y - 6})` : undefined}
          x={c.x}
          y={c.y}
        >
          {wild ? (card === "W4" ? "+4" : "") : centerGlyph(face)}
        </text>
      ))}
    </svg>
  );
}

/** El dorso, para el montón de robar. */
export function CardBack({ width = 64 }: { width?: number }): JSX.Element {
  return (
    <svg
      aria-label="montón de robar"
      height={width * 1.5}
      role="img"
      style={{ display: "block" }}
      viewBox="0 0 100 150"
      width={width}
    >
      <rect
        fill="#1b1b1f"
        height={148}
        rx={12}
        stroke="#ffffff"
        strokeWidth={4}
        width={98}
        x={1}
        y={1}
      />
      <ellipse
        cx={50}
        cy={75}
        fill="#e4463c"
        rx={30}
        ry={46}
        transform="rotate(-20 50 75)"
      />
      <text
        fill="#ffffff"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize={26}
        fontWeight={800}
        textAnchor="middle"
        transform="rotate(-20 50 84)"
        x={50}
        y={84}
      >
        ★
      </text>
    </svg>
  );
}

export { COLOR_LABEL as CARD_COLOR_LABEL, PALETTE as CARD_PALETTE };
