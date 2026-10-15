/**
 * La API publica de `modules/files`.
 *
 * Se nombra lo que se exporta, en vez de `export * from`, a proposito.
 *
 * Con `export *` el modulo publicaba sus 23 simbolos; desde fuera se usan 8.
 * Los otros 15 eran superficie publica sin consumidor: mientras lo fueran,
 * mover o renombrar un detalle interno era un cambio incompatible en potencia,
 * y nadie podia saber cual sin buscar por todo el repo.
 *
 * El test de arquitectura ya prohibe entrar por un subcamino
 * (`@superbot/module-files/src/...`), asi que esta lista **es** la frontera:
 * lo que no este aqui, no lo puede tocar nadie de fuera.
 *
 * Los ficheros siguen exportando sus simbolos con `export` normal — los tests
 * del propio modulo los importan por ruta relativa y deben seguir pudiendo.
 * Lo que se recorta es lo que sale por el index, que es lo que ve el resto.
 *
 * Al anadir algo aqui, la pregunta es quien lo consume desde fuera. Si no hay
 * nadie, no entra.
 */

export {
  defaultFilePolicy,
  parseFilesCommand,
  validateAttachment,
} from "./files.js";
export {
  decryptMediaBuffer,
  EncryptingObjectStorageDriver,
  encryptMediaBuffer,
} from "./media-encryption.js";
export type { ObjectStorageDriver } from "./object-storage.js";
export {
  generateObjectKey,
  LocalObjectStorageDriver,
} from "./object-storage.js";
export { createStorageDriverFromEnv } from "./storage-factory.js";
