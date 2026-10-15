import { classifyAttachment } from "../../dangerous-files.js";
import { detectDoxxing } from "../../doxxing-detector.js";

/**
 * Las dos decisiones de contenido peligroso: adjuntos y fugas de datos.
 *
 * Las dos acaban en la misma accion del nucleo —borrar si el bot es
 * administrador, y avisar si no lo es—, asi que lo que devuelven es la
 * DECISION y sus dos textos, no la respuesta. Enviar y borrar sigue siendo
 * trabajo del nucleo.
 *
 * El copy va literal, byte a byte, desde el servicio. Esto es una extraccion:
 * cambiar una tilde aqui cambiaria lo que lee la gente en el grupo.
 */

/** Que decir al borrar y que decir cuando no se puede borrar. */
export interface DecisionDeBorrado {
  readonly textoBorrado: string;
  readonly textoAviso: string;
}

/**
 * Un adjunto peligroso.
 *
 * OJO AL ORDEN: se clasifica el fichero **antes** de mirar si quien lo mando es
 * administrador. Es deliberado y hay que conservarlo — comprobar el admin
 * primero costaria una consulta por cada mensaje con adjunto del grupo, tambien
 * los inofensivos, que son la inmensa mayoria. Por eso esta funcion no recibe
 * `esAdmin`: quien llama decide si vale la pena preguntarlo.
 */
export const clasificarAdjuntoPeligroso = (
  nombreFichero: string,
): DecisionDeBorrado | null => {
  const veredicto = classifyAttachment(nombreFichero);
  if (!veredicto.dangerous) return null;

  return {
    textoBorrado: `🚫 Archivo bloqueado por seguridad (${veredicto.reason ?? "tipo de archivo peligroso"}).`,
    textoAviso:
      "⚠️ *Ojo con el archivo de arriba* — parece peligroso (podría ser malware). No lo abras ni lo descargues. No puedo borrarlo porque no soy administrador del grupo.",
  };
};

/**
 * Una fuga de datos personales.
 *
 * Aqui el orden del servicio era el CONTRARIO: primero se miraba si es
 * administrador y solo despues se analizaba el texto. Tambien se conserva. La
 * diferencia con el caso del adjunto no es un descuido: el detector de doxxing
 * corre sobre CADA mensaje de texto del grupo, asi que saltarselo pronto para
 * los administradores ahorra mas de lo que cuesta la comprobacion.
 */
export const detectarFugaDeDatos = (
  texto: string,
): DecisionDeBorrado | null => {
  if (!detectDoxxing(texto).matched) return null;

  return {
    textoBorrado:
      "🔒 Mensaje eliminado: parecía contener datos personales (teléfono, correo, DNI o similar).",
    textoAviso:
      "⚠️ *Cuidado* — el mensaje de arriba parece contener datos personales (teléfono, correo, DNI o similar). No lo reenvíes. No puedo borrarlo porque no soy administrador del grupo.",
  };
};
