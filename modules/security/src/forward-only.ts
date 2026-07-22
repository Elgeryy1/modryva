/**
 * Detector de cuentas que solo reenvian contenido externo ("forward-only"):
 * perfiles que casi nunca escriben mensajes propios y en cambio inundan el
 * grupo con reenvios, especialmente reenvios que llevan enlaces externos.
 *
 * Logica pura y determinista: recibe una muestra plana de mensajes recientes
 * (cada uno con `isForward` y `hasUrl`) y no toca red, reloj ni almacenamiento.
 * Segura ante muestras vacias o por debajo del minimo pedido.
 */

/** Un mensaje reciente reducido a las dos senales que importan aqui. */
export interface ForwardOnlyMessage {
  readonly isForward: boolean;
  readonly hasUrl: boolean;
}

/** Resultado del analisis forward-only. `forwardRatio` va de 0 a 1. */
export interface ForwardOnlyResult {
  readonly flagged: boolean;
  readonly forwardRatio: number;
  readonly reason: string;
}

/**
 * Proporcion de reenvios (0..1) a partir de la cual un perfil se marca aunque
 * los reenvios no lleven enlaces.
 */
export const FORWARD_ONLY_HIGH_RATIO = 0.8;

/**
 * Proporcion de reenvios (0..1) a partir de la cual un perfil se marca cuando
 * ademas una parte relevante de esos reenvios lleva enlaces externos.
 */
export const FORWARD_ONLY_LINK_RATIO = 0.6;

/**
 * Fraccion (0..1) de los reenvios que deben llevar enlace para considerar que
 * el patron es "reenvios con links" y aplicar el umbral rebajado.
 */
export const FORWARD_ONLY_LINK_SHARE = 0.5;

const asPercent = (ratio: number): number => Math.round(ratio * 100);

/**
 * Analiza una muestra de mensajes recientes y decide si el autor se comporta
 * como una cuenta que solo reenvia. Con `minMessages` mensajes o mas, marca el
 * perfil cuando la proporcion de reenvios supera `FORWARD_ONLY_HIGH_RATIO`, o
 * cuando supera `FORWARD_ONLY_LINK_RATIO` y buena parte de esos reenvios llevan
 * enlaces externos. Con muestra vacia o insuficiente devuelve `flagged: false`
 * y `forwardRatio: 0`. Pura y determinista.
 */
export const detectForwardOnly = (
  recent: readonly ForwardOnlyMessage[],
  minMessages: number,
): ForwardOnlyResult => {
  const total = recent.length;

  if (total === 0 || total < minMessages) {
    return {
      flagged: false,
      forwardRatio: 0,
      reason: "Muestra insuficiente para evaluar reenvios.",
    };
  }

  let forwards = 0;
  let forwardLinks = 0;
  for (const message of recent) {
    if (message.isForward) {
      forwards += 1;
      if (message.hasUrl) {
        forwardLinks += 1;
      }
    }
  }

  const forwardRatio = forwards / total;
  const linkShare = forwards === 0 ? 0 : forwardLinks / forwards;
  const withLinks =
    forwardRatio >= FORWARD_ONLY_LINK_RATIO &&
    linkShare >= FORWARD_ONLY_LINK_SHARE;
  const flagged = forwardRatio >= FORWARD_ONLY_HIGH_RATIO || withLinks;

  if (!flagged) {
    return {
      flagged: false,
      forwardRatio,
      reason: `Actividad normal: ${asPercent(forwardRatio)}% de reenvios.`,
    };
  }

  if (withLinks) {
    return {
      flagged: true,
      forwardRatio,
      reason: `Perfil de solo-reenvios con enlaces externos: ${asPercent(
        forwardRatio,
      )}% reenviado, ${asPercent(linkShare)}% con enlace.`,
    };
  }

  return {
    flagged: true,
    forwardRatio,
    reason: `Perfil de solo-reenvios: ${asPercent(
      forwardRatio,
    )}% de los mensajes son reenviados.`,
  };
};
