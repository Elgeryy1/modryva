import { EncryptingObjectStorageDriver } from "./media-encryption.js";
import {
  LocalObjectStorageDriver,
  type ObjectStorageDriver,
  S3ObjectStorageDriver,
} from "./object-storage.js";

export interface StorageFactoryEnv {
  readonly GUARDIAN_STORAGE_DRIVER: "local" | "s3";
  readonly GUARDIAN_STORAGE_PATH: string;
  readonly S3_ENDPOINT?: string | undefined;
  readonly S3_BUCKET?: string | undefined;
  readonly S3_ACCESS_KEY?: string | undefined;
  readonly S3_SECRET_KEY?: string | undefined;
  readonly S3_REGION?: string | undefined;
  /** When set, every driver (local AND S3) is wrapped in
   * EncryptingObjectStorageDriver — captured media is never written
   * unprotected, regardless of the backing storage's own encryption. */
  readonly GUARDIAN_MEDIA_ENCRYPTION_KEY?: string | undefined;
  /** Optional decrypt-only fallback for a media key rotation window: reads
   * that fail under the primary key retry under this one, so media written
   * before the switch stays readable until it ages out of retention. Removed
   * once the rotation is finished. Meaningless without the primary key and must
   * never equal it. */
  readonly GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS?: string | undefined;
}

/** Builds the configured ObjectStorageDriver (local dev filesystem or S3) from
 * runtime env — the single place that decides which driver Guardian uses.
 * Shared by apps/api (upload/read) and apps/worker (retention cleanup) so
 * both always agree on which driver/bucket/path is authoritative. */
export const createStorageDriverFromEnv = (
  env: StorageFactoryEnv,
): ObjectStorageDriver => {
  let driver: ObjectStorageDriver;
  if (env.GUARDIAN_STORAGE_DRIVER === "s3") {
    if (
      !env.S3_ENDPOINT ||
      !env.S3_BUCKET ||
      !env.S3_ACCESS_KEY ||
      !env.S3_SECRET_KEY ||
      !env.S3_REGION
    ) {
      throw new Error("s3-storage-misconfigured");
    }
    driver = new S3ObjectStorageDriver({
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
      region: env.S3_REGION,
    });
  } else {
    driver = new LocalObjectStorageDriver(env.GUARDIAN_STORAGE_PATH);
  }

  const previous = env.GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS;
  if (!env.GUARDIAN_MEDIA_ENCRYPTION_KEY) {
    // A previous key without a primary is a meaningless (and dangerous)
    // configuration — nothing would encrypt new writes. Fail loudly rather than
    // silently storing media unprotected while a "rotation" is believed active.
    if (previous !== undefined) {
      throw new Error("guardian-media-previous-key-without-primary");
    }
    return driver;
  }
  if (
    previous !== undefined &&
    previous === env.GUARDIAN_MEDIA_ENCRYPTION_KEY
  ) {
    // Identical primary/previous is a no-op that silently masks a botched
    // rotation (it looks like a fallback exists when it does not). Reject it.
    throw new Error("guardian-media-previous-key-equals-primary");
  }
  return new EncryptingObjectStorageDriver(
    driver,
    env.GUARDIAN_MEDIA_ENCRYPTION_KEY,
    previous,
  );
};
