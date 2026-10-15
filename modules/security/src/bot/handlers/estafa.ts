import { detectCamouflagedLink } from "../../camouflaged-link.js";
import { detectCommercialUsername } from "../../commercial-username.js";
import { detectCovertInvite } from "../../covert-invite.js";
import { detectDmBait } from "../../dm-bait.js";
import { detectFakeAirdrop } from "../../fake-airdrop.js";
import { detectFakeScreenshotClaim } from "../../fake-screenshot.js";
import { detectFakeSocialProof } from "../../fake-social-proof.js";
import { detectUnrealPromises } from "../../unreal-promises.js";
import { detectUsernameLink } from "../../username-link.js";
import type { DecisionDeBorrado } from "./contenido-peligroso.js";

/**
 * La deteccion de estafa por acumulacion de senales.
 *
 * Aqui la logica no es un detector, sino **la politica**: se cuentan nueve
 * senales independientes y hace falta que coincidan **dos o mas** para actuar.
 * Ese umbral es la decision de producto y estaba enterrada en medio de un
 * handler, sin nombre y sin un solo test que lo fijara.
 *
 * Que sean dos y no una importa mucho: con una sola senal el bot borraria
 * mensajes legitimos constantemente —un enlace acortado, un usuario con un
 * nombre comercial— y con tres se le escaparia casi todo. Cambiar este numero
 * cambia cuanta gente inocente ve su mensaje borrado.
 */

/** Cuantas senales de estafa hacen falta para borrar. */
export const SENALES_PARA_ACTUAR = 2;

/** El detalle de la evaluacion, util para explicar por que se actuo. */
export interface EvaluacionDeEstafa {
  readonly senales: number;
  readonly supera: boolean;
}

/**
 * Cuenta las senales de estafa de un mensaje y su autor.
 *
 * El nombre de usuario cuenta como senal igual que el texto: un `@vendo_cripto`
 * repartiendo enlaces es la combinacion clasica.
 */
export const evaluarSenalesDeEstafa = (entrada: {
  readonly texto: string;
  readonly usuario: string | undefined;
}): EvaluacionDeEstafa => {
  const senales = [
    detectCamouflagedLink(entrada.texto).matched,
    detectCovertInvite(entrada.texto).matched,
    detectDmBait(entrada.texto).matched,
    detectFakeAirdrop(entrada.texto).matched,
    detectFakeScreenshotClaim(entrada.texto).matched,
    detectFakeSocialProof(entrada.texto).matched,
    detectUnrealPromises(entrada.texto).matched,
    detectCommercialUsername(entrada.usuario).matched,
    detectUsernameLink(entrada.usuario).matched,
  ].filter(Boolean).length;

  return { senales, supera: senales >= SENALES_PARA_ACTUAR };
};

/**
 * La decision completa: si hay que borrar y con que textos.
 *
 * El copy va literal desde el servicio, byte a byte.
 */
export const decidirSobreEstafa = (entrada: {
  readonly texto: string;
  readonly usuario: string | undefined;
}): DecisionDeBorrado | null => {
  if (!evaluarSenalesDeEstafa(entrada).supera) return null;

  return {
    textoBorrado:
      "🚫 Mensaje eliminado: coincide con varias señales típicas de estafa.",
    textoAviso:
      "⚠️ *Cuidado, posible estafa* — el mensaje de arriba tiene varias señales típicas de fraude (enlaces camuflados, promesas irreales, MD no solicitados…). No hagas clic ni compartas datos. No puedo borrarlo porque no soy administrador del grupo.",
  };
};
