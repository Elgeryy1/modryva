/**
 * Modos de densidad de la MiniApp: ajustan cuanto se muestra y cuanto se anima
 * segun las preferencias del usuario o el estado del dispositivo. "compacto"
 * apila mas filas y desactiva adornos; "normal" es el equilibrio por defecto;
 * "bateria" (baja bateria) apaga blur, animaciones e imagenes para ahorrar.
 * Logica pura y determinista: sin I/O ni estado.
 */

/** Resultado de resolver un modo de densidad en ajustes de render concretos. */
export interface DensitySettings {
  readonly blur: boolean;
  readonly animations: boolean;
  readonly rowsPerScreen: number;
  readonly images: boolean;
}

/** Modos de densidad soportados, en orden de mayor a menor riqueza visual. */
export const DENSITY_MODES = ["normal", "compacto", "bateria"] as const;

/** Union de los identificadores de modo validos. */
export type DensityMode = (typeof DENSITY_MODES)[number];

const DENSITY_TABLE: Readonly<Record<DensityMode, DensitySettings>> = {
  normal: { blur: true, animations: true, rowsPerScreen: 8, images: true },
  compacto: { blur: false, animations: true, rowsPerScreen: 14, images: true },
  bateria: { blur: false, animations: false, rowsPerScreen: 12, images: false },
};

/**
 * True cuando `m` es exactamente uno de los modos soportados. Comparacion
 * sensible a mayusculas y sin recortar espacios. Pura y determinista.
 */
export const isDensityMode = (m: string): m is DensityMode =>
  (DENSITY_MODES as readonly string[]).includes(m);

/**
 * Resuelve un modo de densidad en sus ajustes de render. Un modo desconocido
 * cae a "normal" (el ajuste por defecto seguro). Devuelve una copia nueva en
 * cada llamada para que el llamador pueda mutarla sin afectar la tabla interna.
 * Pura y determinista.
 */
export const resolveDensity = (mode: string): DensitySettings => {
  const key: DensityMode = isDensityMode(mode) ? mode : "normal";
  const settings = DENSITY_TABLE[key];
  return {
    blur: settings.blur,
    animations: settings.animations,
    rowsPerScreen: settings.rowsPerScreen,
    images: settings.images,
  };
};
