"use client";

// La vista de una mascota, sin saber de donde salen los datos.
//
// Separado de la pagina a proposito: la pagina se ocupa de pedir, reintentar y
// avisar; esto solo pinta. Asi la pantalla se puede ver con datos de ejemplo
// sin una firma de Telegram, que es la unica forma de juzgar como queda antes
// de subirla.
//
// **Sin estilos en linea con colores a pelo.** Todo sale de las clases de
// globals.css y de los tokens del tema: un `#4a9d5f` escrito aqui se ve bien en
// oscuro y mal en claro, y no cambia cuando alguien toca el tema de Telegram.
// Lo unico que viaja por `style` es el color de familia, que es un dato.

import type { CSSProperties, ReactNode } from "react";
import { Button, Empty, Group, GroupNote, Section } from "./ui";

export interface MascotaVisible {
  especie: string;
  nombreEspecie: string;
  descripcion: string;
  familia: string;
  glifo: string;
  nombre: string | null;
  cara: string;
  /** Ruta del sprite, servida desde `public/mascotas`. */
  retrato: string;
  hambre: number;
  animo: number;
  nivel: number;
  progreso: number;
  rasgos: string[];
  racionesHoy: number;
  haJugadoHoy: boolean;
  regalada: boolean;
  usuario: string;
}

/**
 * El color de cada familia.
 *
 * Duplicado del que uso el generador de los sprites, y es a proposito:
 * traerlo de `@superbot/module-games` obligaria a un import de VALOR desde un
 * fichero "use client", y eso mete el barrel del paquete —pino y zod dentro—
 * en el bundle del navegador. Son seis constantes; la copia es mas barata que
 * la dependencia. Lo dice next.config.ts.
 */
const COLOR_DE_FAMILIA: Record<string, string> = {
  bolsa: "#E9B949",
  sombra: "#D2803F",
  muro: "#6FA779",
  pluma: "#9A8CC4",
  lazo: "#E0876F",
  azar: "#63B7B0",
};

const estiloDeFamilia = (familia: string): CSSProperties =>
  ({ "--fam": COLOR_DE_FAMILIA[familia] ?? "var(--muted)" }) as CSSProperties;

/**
 * Que color lleva una barra.
 *
 * Lo decide el VALOR y no el tipo de barra. Una barra al 12% tiene que alarmar
 * aunque sea la del animo: si el hambre fuera siempre verde y el animo siempre
 * ambar, el color dejaria de informar y solo decoraria.
 */
const tonoDeBarra = (valor: number): string => {
  if (valor <= 25) {
    return "barra-mal";
  }
  if (valor <= 55) {
    return "barra-media";
  }
  return "barra-bien";
};

export function Barra({
  etiqueta,
  valor,
  sufijo,
  neutra,
}: {
  etiqueta: string;
  valor: number;
  sufijo?: string;
  /**
   * Sin semantica de urgencia.
   *
   * El hambre al 20% es una alarma; la experiencia al 20% es haber empezado el
   * nivel hace poco. Pintarlas igual convierte el progreso normal en un aviso
   * rojo, y entonces el color deja de significar nada en las tres barras.
   */
  neutra?: boolean;
}) {
  const acotado = Math.max(0, Math.min(100, Math.round(valor)));
  return (
    <div>
      <div className="barra-cab">
        <span className="barra-nom">{etiqueta}</span>
        <span className="barra-val">
          {acotado}
          {sufijo ?? ""}
        </span>
      </div>
      <div
        className="barra-riel"
        role="progressbar"
        aria-label={etiqueta}
        aria-valuenow={acotado}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`barra-relleno ${neutra ? "barra-neutra" : tonoDeBarra(acotado)}`}
          style={{ width: `${acotado}%` }}
        />
      </div>
    </div>
  );
}

/**
 * El retrato.
 *
 * Una imagen, no marcado inyectado: la ruta la da el servidor y el navegador la
 * carga como cualquier otra. Antes esto era un SVG compuesto por codigo que
 * entraba con `dangerouslySetInnerHTML`, y ademas de necesitar esa excepcion,
 * pintaba el mismo circulo con orejas para las seis especies.
 */
export function Retrato({
  src,
  alt,
  clase,
}: {
  src: string;
  alt: string;
  clase: string;
}) {
  return (
    <div className={clase}>
      {/* Sin `next/image`: son PNG estaticos de 256 px que ya vienen del tamaño
          justo, asi que el optimizador no tiene nada que optimizar y a cambio
          mete una ruta de servidor en medio. */}
      {/** biome-ignore lint/performance/noImgElement: sprite estatico ya dimensionado. */}
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </div>
  );
}

/** La ficha del bicho propio. */
export function FichaDeMascota({
  mascota,
  precioRacion,
  racionesPorDia,
  ocupado,
  onAlimentar,
  onJugar,
}: {
  mascota: MascotaVisible;
  precioRacion: number;
  racionesPorDia: number;
  ocupado?: boolean;
  onAlimentar?: () => void;
  onJugar?: () => void;
}) {
  const sinRaciones = mascota.racionesHoy >= racionesPorDia;
  const durmiendo = mascota.cara === "dormido";

  return (
    <Section>
      <div
        className={`bicho bicho-card${durmiendo ? " bicho-dormido" : ""}`}
        style={estiloDeFamilia(mascota.familia)}
      >
        <Retrato
          src={mascota.retrato}
          alt={mascota.nombreEspecie}
          clase="bicho-retrato"
        />

        <div>
          <p className="bicho-nombre">
            {mascota.nombre ?? mascota.nombreEspecie}
          </p>
          <p className="bicho-especie">{mascota.descripcion}</p>
        </div>

        <div className="bicho-chips">
          <span className="chip chip-fam">
            {mascota.glifo} {mascota.nombreEspecie}
          </span>
          <span className="chip">Nivel {mascota.nivel}</span>
          {mascota.rasgos.map((rasgo) => (
            <span className="chip" key={rasgo}>
              {rasgo}
            </span>
          ))}
          {mascota.regalada ? (
            <span className="chip chip-regalo">✦ Regalo</span>
          ) : null}
        </div>

        <div className="barras">
          <Barra etiqueta="Hambre" valor={mascota.hambre} />
          <Barra etiqueta="Ánimo" valor={mascota.animo} />
          <Barra
            etiqueta={`Experiencia · nivel ${mascota.nivel}`}
            valor={mascota.progreso}
            sufijo="%"
            neutra
          />
        </div>
      </div>

      <Button onClick={onAlimentar} disabled={ocupado || sinRaciones}>
        {sinRaciones
          ? "Ya ha comido bastante hoy"
          : `Dar de comer · ${precioRacion} monedas`}
      </Button>
      {/* Jugar va DESPUES de comer y en secundario: comer es lo que la salva de
          dormirse, y dos botones con el mismo peso harian dudar a quien entra
          con el bicho a punto de caer. Se dice que es gratis en el propio boton
          porque nadie pulsa lo que cree que le va a costar monedas. */}
      <Button
        onClick={onJugar}
        disabled={ocupado || mascota.haJugadoHoy}
        variant="secondary"
      >
        {mascota.haJugadoHoy ? "Ya habéis jugado hoy" : "Jugar · gratis"}
      </Button>
      <GroupNote>
        {durmiendo
          ? "Está dormido de hambre. Se despierta comiendo."
          : `${mascota.racionesHoy} de ${racionesPorDia} raciones hoy.` +
            (mascota.haJugadoHoy ? "" : " Jugar con él le sube el ánimo.")}
      </GroupNote>
    </Section>
  );
}

/** Lo que se enseña a quien todavia no tiene bicho. */
export function SinMascota({
  precioHuevo,
  ocupado,
  onConseguir,
}: {
  precioHuevo: number;
  ocupado?: boolean;
  onConseguir?: () => void;
}) {
  return (
    <Section>
      <div className="bicho-card">
        <div className="huevo">
          <span className="huevo-emoji" aria-hidden="true">
            🥚
          </span>
        </div>
        <p className="bicho-nombre">Todavía no tienes bicho</p>
        <p className="bicho-especie">
          Sale de un huevo, y no se elige cuál te toca.{" "}
          {precioHuevo === 0
            ? "El primero va por cuenta de la casa."
            : `Cuesta ${precioHuevo} monedas.`}
        </p>
      </div>
      <Button onClick={onConseguir} disabled={ocupado}>
        {precioHuevo === 0
          ? "Conseguir mi bicho (gratis)"
          : `Comprar un huevo · ${precioHuevo}`}
      </Button>
    </Section>
  );
}

/** El corral del grupo. */
export function Corral({
  entradas,
}: {
  entradas: readonly (MascotaVisible & { esMia: boolean })[];
}): ReactNode {
  return (
    <Section caption={`El corral · ${entradas.length}`}>
      {entradas.length === 0 ? (
        <Empty
          icon="🌾"
          title="Nadie tiene bicho todavía"
          hint="Sé el primero: el primer huevo es gratis."
        />
      ) : (
        <Group>
          <div className="corral">
            {entradas.map((otra) => (
              <div
                key={otra.usuario}
                className={`corral-celda${otra.esMia ? " es-mia" : ""}${
                  otra.cara === "dormido" ? " durmiendo" : ""
                }`}
                style={estiloDeFamilia(otra.familia)}
                title={`${otra.nombre ?? otra.nombreEspecie} · nivel ${otra.nivel}`}
              >
                <Retrato
                  src={otra.retrato}
                  alt={otra.nombreEspecie}
                  clase="corral-retrato"
                />
                <span className="corral-nom">
                  {otra.nombre ?? otra.nombreEspecie}
                  {otra.regalada ? " ✦" : ""}
                </span>
                <span className="corral-niv">Nivel {otra.nivel}</span>
              </div>
            ))}
          </div>
        </Group>
      )}
    </Section>
  );
}
