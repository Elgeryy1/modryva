/**
 * A quien NO se puede fbanear, y por que.
 *
 * Un `fban` echa a alguien de **todos los grupos de la federación a la vez**,
 * asi que es el comando mas destructivo que tiene un admin de federación. Estas
 * cuatro guardas son lo unico que impide que se use hacia dentro.
 *
 * Estaban inline en el handler, sin un solo test, entre lecturas del
 * repositorio y copy. Aqui tienen nombre y se prueban.
 *
 * **El orden es comportamiento**, no casualidad: cuando dos vetos aplican a la
 * vez, el primero es el que se dice. Y lo que se dice importa — "no puedes
 * fbanear al dueño" y "solo el dueño puede sancionar a otros admins" mandan a
 * la persona a sitios distintos.
 */

/** Por que no se puede, o `null` si si se puede. */
export type VetoDeFban =
  /** Es el dueño de la federación: nadie lo toca. */
  | "es-el-dueno"
  /** Se lo esta haciendo a si mismo. */
  | "eres-tu"
  /** Es el propio bot: se quedaria sin poder deshacerlo. */
  | "soy-yo"
  /** Es otro admin de la federación, y quien pide no es el dueño. */
  | "es-otro-admin";

/**
 * Decide si se puede fbanear.
 *
 * `objetivoEsAdmin` llega como funcion y no como booleano **a proposito**: es
 * una consulta a la base de datos y en el código original solo se hacia si
 * quien pedia no era el dueño. Pasarla ya resuelta obligaria a consultarla
 * siempre.
 */
export const vetoParaFbanear = async (entrada: {
  readonly objetivo: bigint;
  readonly quienPide: bigint | undefined;
  readonly duenoDeLaFederacion: bigint;
  readonly idDelBot: bigint | undefined;
  readonly objetivoEsAdmin: () => Promise<boolean>;
}): Promise<VetoDeFban | null> => {
  if (entrada.objetivo === entrada.duenoDeLaFederacion) {
    return "es-el-dueno";
  }
  if (
    entrada.quienPide !== undefined &&
    entrada.objetivo === entrada.quienPide
  ) {
    return "eres-tu";
  }
  if (entrada.idDelBot !== undefined && entrada.objetivo === entrada.idDelBot) {
    return "soy-yo";
  }

  const quienPideEsDueno =
    entrada.quienPide !== undefined &&
    entrada.quienPide === entrada.duenoDeLaFederacion;
  if (!quienPideEsDueno && (await entrada.objetivoEsAdmin())) {
    return "es-otro-admin";
  }

  return null;
};

/** Lo que se le dice a quien lo intento. */
export const textoDeVetoDeFban = (veto: VetoDeFban): string => {
  switch (veto) {
    case "es-el-dueno":
      return "No puedes fbanear al dueño de la federación.";
    case "eres-tu":
      return "No puedes fbanearte a ti mismo.";
    case "soy-yo":
      return "No puedo fbanearme a mi mismo.";
    case "es-otro-admin":
      return "Solo el dueño de la federación puede sancionar a otros admins.";
  }
};
