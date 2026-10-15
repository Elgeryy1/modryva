import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  EMPTY_BODY_SHA256,
  type S3SignerConfig,
  signS3ObjectRequest,
  UNSIGNED_PAYLOAD,
} from "./s3-signer.js";

/**
 * Object storage abstraction: a local-filesystem driver for development/tests
 * and an S3-compatible driver for production, behind one interface. Neither
 * driver exposes "signed URLs" directly — callers that need a temporary link
 * (e.g. Guardian's STAFF media preview) should mediate access through their
 * own signed-token endpoint, which works identically regardless of the
 * backing driver and keeps access centrally logged/revocable.
 */

export interface PutObjectInput {
  readonly key: string;
  readonly data: Buffer;
  readonly contentType: string;
}

export interface ObjectStorageDriver {
  readonly kind: "local" | "s3";
  put(input: PutObjectInput): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/** Non-predictable object key: random bytes, never derived from user input. */
export const generateObjectKey = (
  prefix: string,
  extension: string,
): string => {
  const random = randomBytes(24).toString("base64url");
  const safePrefix = prefix.replace(/[^a-zA-Z0-9/_-]/gu, "");
  return `${safePrefix}/${random}.${extension}`;
};

const resolveWithinRoot = (root: string, key: string): string => {
  const resolved = path.resolve(root, key);
  const normalizedRoot = path.resolve(root);
  if (
    !resolved.startsWith(normalizedRoot + path.sep) &&
    resolved !== normalizedRoot
  ) {
    throw new Error("path-traversal-rejected");
  }
  return resolved;
};

export class LocalObjectStorageDriver implements ObjectStorageDriver {
  readonly kind = "local" as const;

  constructor(private readonly rootDir: string) {}

  async put({ key, data }: PutObjectInput): Promise<void> {
    const filePath = resolveWithinRoot(this.rootDir, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp-${randomBytes(6).toString("hex")}`;
    try {
      await writeFile(tmpPath, data);
      await rename(tmpPath, filePath);
    } catch (err) {
      // Never leave a stray temp copy of captured media behind on a failed
      // write/rename — best-effort cleanup, rethrow the original error.
      await rm(tmpPath, { force: true });
      throw err;
    }
  }

  async get(key: string): Promise<Buffer | null> {
    const filePath = resolveWithinRoot(this.rootDir, key);
    try {
      return await readFile(filePath);
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = resolveWithinRoot(this.rootDir, key);
    try {
      await rm(filePath, { force: true });
    } catch {
      // Already gone — deletion is idempotent.
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = resolveWithinRoot(this.rootDir, key);
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export interface S3DriverConfig extends S3SignerConfig {
  readonly bucket: string;
}

/**
 * S3-compatible driver using hand-rolled SigV4 signing (see s3-signer.ts) —
 * works against AWS S3 and MinIO. NOT exercised against a live bucket in this
 * session; verify against your actual endpoint before production use, or
 * swap in @aws-sdk/client-s3 behind this same interface if you'd rather not
 * run hand-rolled signing.
 *
 * Encryption note: this driver does NOT send an `x-amz-server-side-encryption`
 * header — it relies entirely on the bucket's own default encryption
 * setting (enable SSE-S3 or SSE-KMS at the bucket level in your provider's
 * console/IaC). This is on top of, not instead of, Guardian's own app-layer
 * AES-256-GCM encryption (see media-encryption.ts, applied via
 * GUARDIAN_MEDIA_ENCRYPTION_KEY in storage-factory.ts) — when that key is
 * configured, media is encrypted before it ever reaches this driver, so a
 * captured face/gesture video is never stored unprotected here regardless of
 * whether the bucket's own SSE is enabled correctly.
 */
export class S3ObjectStorageDriver implements ObjectStorageDriver {
  readonly kind = "s3" as const;

  constructor(private readonly config: S3DriverConfig) {}

  async put({ key, data, contentType }: PutObjectInput): Promise<void> {
    const signed = signS3ObjectRequest(this.config, {
      method: "PUT",
      bucket: this.config.bucket,
      key,
      contentType,
      payloadHash: UNSIGNED_PAYLOAD,
    });
    const response = await fetch(signed.url, {
      method: "PUT",
      headers: signed.headers,
      body: data,
    });
    if (!response.ok) {
      throw new Error(`S3 PUT failed with status ${response.status}`);
    }
  }

  async get(key: string): Promise<Buffer | null> {
    const signed = signS3ObjectRequest(this.config, {
      method: "GET",
      bucket: this.config.bucket,
      key,
      payloadHash: EMPTY_BODY_SHA256,
    });
    const response = await fetch(signed.url, {
      method: "GET",
      headers: signed.headers,
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`S3 GET failed with status ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const signed = signS3ObjectRequest(this.config, {
      method: "DELETE",
      bucket: this.config.bucket,
      key,
      payloadHash: EMPTY_BODY_SHA256,
    });
    const response = await fetch(signed.url, {
      method: "DELETE",
      headers: signed.headers,
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`S3 DELETE failed with status ${response.status}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    const signed = signS3ObjectRequest(this.config, {
      method: "HEAD",
      bucket: this.config.bucket,
      key,
      payloadHash: EMPTY_BODY_SHA256,
    });
    const response = await fetch(signed.url, {
      method: "HEAD",
      headers: signed.headers,
    });
    return response.ok;
  }
}
