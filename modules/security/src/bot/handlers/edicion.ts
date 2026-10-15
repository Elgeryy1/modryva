import { classifyEditRisk } from "../../edit-risk.js";
import { detectEditSpam, textoDeMotivoDeEdicion } from "../../edit-spam.js";

/**
 * `edit-guard.ambient`: avisa cuando alguien edita un mensaje de forma
 * sospechosa.
 *
 * El patron clasico es llegar limpio y colar el enlace despues, cuando la
 * moderacion ya ha mirado el mensaje. Por eso se compara el ANTES con el
 * DESPUES y no solo el resultado.
 *
 * A diferencia de las extracciones anteriores, aqui se lleva la **orquestacion
 * entera**, no solo la decision: buscar el original, calcular los segundos
 * transcurridos, decidir y redactar. En el nucleo se queda unicamente traducir
 * el update y construir el adaptador.
 *
 * Este handler **avisa, no borra ni sanciona**. Eso importa para leer la
 * precedencia de abajo: equivocarse de motivo empeora el mensaje, no castiga a
 * nadie de mas.
 */

/** Lo que hace falta saber del mensaje original para compararlo. */
export interface MensajeOriginal {
  readonly texto: string;
  readonly teniaEnlace: boolean;
  readonly teniaMencion: boolean;
  readonly publicadoEn: Date;
}

/**
 * Lo unico que este handler necesita de la persistencia.
 *
 * Lo declara el MODULO y no `packages/domain`: los puertos del dominio son
 * transversales (Telegram, permisos, reloj) y la persistencia de cada módulo es
 * suya.
 */
export interface OriginalDeMensajePort {
  buscar(mensajeId: bigint): Promise<MensajeOriginal | null>;
}

/** El update ya normalizado. El módulo no sabe que forma tiene un update. */
export interface EdicionParaRevisar {
  readonly mensajeId: bigint | undefined;
  readonly textoNuevo: string | undefined;
  readonly tieneEnlace: boolean;
  readonly tieneMencion: boolean;
}

/** El aviso, o `null` si no hay nada que decir. */
export const revisarEdicion = async (
  edicion: EdicionParaRevisar,
  original: OriginalDeMensajePort,
  ahoraMs: number,
): Promise<string | null> => {
  if (edicion.mensajeId === undefined || edicion.textoNuevo === undefined) {
    return null;
  }

  const antes = await original.buscar(edicion.mensajeId);
  if (antes === null) {
    // El original cayo fuera de la ventana del registro. Sin el no hay
    // comparacion posible, y avisar a ciegas seria peor que callarse.
    return null;
  }

  const spam = detectEditSpam(
    {
      hasUrl: antes.teniaEnlace,
      hasMention: antes.teniaMencion,
      text: antes.texto,
    },
    {
      hasUrl: edicion.tieneEnlace,
      hasMention: edicion.tieneMencion,
      text: edicion.textoNuevo,
    },
  );

  const segundosDesde = Math.max(
    0,
    Math.round((ahoraMs - antes.publicadoEn.getTime()) / 1000),
  );
  const riesgo = classifyEditRisk({
    oldHasUrl: antes.teniaEnlace,
    newHasUrl: edicion.tieneEnlace,
    oldLen: antes.texto.length,
    newLen: edicion.textoNuevo.length,
    secondsAfterPost: segundosDesde,
  });

  if (!spam.suspicious && riesgo.risk !== "alto") {
    return null;
  }

  // La precedencia: si es sospechosa por spam, ESE motivo manda sobre el de
  // riesgo. Los dos pueden saltar a la vez y solo se dice uno.
  const motivo = spam.suspicious
    ? textoDeMotivoDeEdicion(spam.reason)
    : riesgo.reason;

  return `✏️ Edición sospechosa: ${motivo}.`;
};
