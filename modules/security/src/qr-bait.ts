/**
 * Deteccion por TEXTO de ganchos de QR sospechosos (sin leer la imagen). Muchos
 * scams empujan a la victima a escanear un codigo QR ("escanea el QR", "codigo
 * QR de pago") para llevarla fuera de Telegram o hacia un cobro. Este modulo
 * inspecciona solo el texto del mensaje y emite una senal con la forma que
 * consume el motor de riesgo. Puro y determinista: sin I/O, red ni relojes.
 */

/**
 * Senal emitida por el detector. `key` identifica la regla que disparo (o
 * "qr-bait-none" cuando no hay senal), `weight` es el peso para el motor y
 * `present` indica si se detecto gancho. `detail` solo aparece cuando hay
 * coincidencia y describe la frase concreta hallada.
 */
export interface QrBaitSignal {
  readonly key: string;
  readonly weight: number;
  readonly present: boolean;
  readonly detail?: string;
}

/** Regla de deteccion: una `key`, su `weight` y las frases que la disparan. */
interface QrBaitRule {
  readonly key: string;
  readonly weight: number;
  readonly phrases: readonly string[];
}

/**
 * Reglas ordenadas por prioridad (la primera que coincide gana). Las frases NO
 * se solapan entre reglas: se prueban por posicion de aparicion en el texto y,
 * a igual posicion, gana la regla mas arriba en esta lista. Frases en minuscula
 * y sin acentos porque el texto se normaliza antes de comparar.
 */
const QR_BAIT_RULES: readonly QrBaitRule[] = [
  {
    key: "qr-bait-payment",
    weight: 5,
    phrases: ["qr de pago", "codigo qr de pago", "escanea para pagar"],
  },
  {
    key: "qr-bait-scan-to",
    weight: 4,
    phrases: ["escanea para", "escanear para", "escanea y", "escanea este"],
  },
  {
    key: "qr-bait-scan-qr",
    weight: 3,
    phrases: [
      "escanea el qr",
      "escanea el codigo qr",
      "escanear el qr",
      "scan qr",
    ],
  },
  {
    key: "qr-bait-qr-code",
    weight: 2,
    phrases: ["codigo qr", "qr code"],
  },
];

/** Key de la senal cuando no se detecta ningun gancho de QR. */
export const QR_BAIT_NONE_KEY = "qr-bait-none";

/**
 * Normaliza el texto para comparar: minusculas, quita diacriticos (acentos) y
 * colapsa cualquier espacio en blanco a un unico espacio. Deja el texto listo
 * para buscar frases planas sin acentos.
 */
const normalizeQrBaitText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Detecta un gancho de QR sospechoso en el texto. Devuelve la senal de la
 * primera frase por POSICION de aparicion (a igual posicion gana la regla de
 * mayor prioridad en `QR_BAIT_RULES`). Sin coincidencia devuelve una senal
 * con `present: false`, `weight: 0` y sin `detail`. Puro y determinista.
 */
export const detectQrBait = (text: string): QrBaitSignal => {
  const normalized = normalizeQrBaitText(text);

  if (normalized.length === 0) {
    return { key: QR_BAIT_NONE_KEY, weight: 0, present: false };
  }

  let bestIndex = Number.POSITIVE_INFINITY;
  let bestRule: QrBaitRule | undefined;
  let bestPhrase: string | undefined;

  for (const rule of QR_BAIT_RULES) {
    for (const phrase of rule.phrases) {
      const at = normalized.indexOf(phrase);
      if (at !== -1 && at < bestIndex) {
        bestIndex = at;
        bestRule = rule;
        bestPhrase = phrase;
      }
    }
  }

  if (bestRule === undefined || bestPhrase === undefined) {
    return { key: QR_BAIT_NONE_KEY, weight: 0, present: false };
  }

  return {
    key: bestRule.key,
    weight: bestRule.weight,
    present: true,
    detail: bestPhrase,
  };
};
