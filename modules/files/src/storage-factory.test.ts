import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStorageDriverFromEnv } from "./storage-factory.js";

describe("createStorageDriverFromEnv", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "guardian-storage-factory-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes plaintext to disk when no encryption key is configured", async () => {
    const driver = createStorageDriverFromEnv({
      GUARDIAN_STORAGE_DRIVER: "local",
      GUARDIAN_STORAGE_PATH: root,
    });
    const original = Buffer.from("unencrypted by default");
    await driver.put({
      key: "f.bin",
      data: original,
      contentType: "text/plain",
    });

    const onDisk = await readFile(path.join(root, "f.bin"));
    expect(onDisk.equals(original)).toBe(true);
  });

  it("writes ciphertext to disk (never plaintext) when a media encryption key IS configured", async () => {
    const driver = createStorageDriverFromEnv({
      GUARDIAN_STORAGE_DRIVER: "local",
      GUARDIAN_STORAGE_PATH: root,
      GUARDIAN_MEDIA_ENCRYPTION_KEY: "a-real-32-byte-secret-goes-here!",
    });
    const original = Buffer.from("this must never land on disk in the clear");
    await driver.put({
      key: "g.bin",
      data: original,
      contentType: "text/plain",
    });

    const onDisk = await readFile(path.join(root, "g.bin"));
    expect(onDisk.includes(original)).toBe(false);

    // But the driver itself still transparently decrypts on read.
    const readBack = await driver.get("g.bin");
    expect(readBack?.equals(original)).toBe(true);
  });

  it("throws for a misconfigured S3 driver rather than silently falling back to local", () => {
    expect(() =>
      createStorageDriverFromEnv({
        GUARDIAN_STORAGE_DRIVER: "s3",
        GUARDIAN_STORAGE_PATH: root,
      }),
    ).toThrow("s3-storage-misconfigured");
  });

  it("reads previous-key media during a rotation window, then fails closed after retirement", async () => {
    const oldKey = "old-media-key-please-ignore-000000";
    const newKey = "new-media-key-please-ignore-111111";
    const original = Buffer.from("captured before the media-key rotation");

    // Written before the switch: on disk it is ciphertext under the OLD key.
    const before = createStorageDriverFromEnv({
      GUARDIAN_STORAGE_DRIVER: "local",
      GUARDIAN_STORAGE_PATH: root,
      GUARDIAN_MEDIA_ENCRYPTION_KEY: oldKey,
    });
    await before.put({
      key: "old.bin",
      data: original,
      contentType: "text/plain",
    });

    // During the window (primary=new, previous=old): still readable.
    const during = createStorageDriverFromEnv({
      GUARDIAN_STORAGE_DRIVER: "local",
      GUARDIAN_STORAGE_PATH: root,
      GUARDIAN_MEDIA_ENCRYPTION_KEY: newKey,
      GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS: oldKey,
    });
    expect((await during.get("old.bin"))?.equals(original)).toBe(true);

    // After retiring the previous key (primary only): no longer readable.
    const after = createStorageDriverFromEnv({
      GUARDIAN_STORAGE_DRIVER: "local",
      GUARDIAN_STORAGE_PATH: root,
      GUARDIAN_MEDIA_ENCRYPTION_KEY: newKey,
    });
    expect(await after.get("old.bin")).toBeNull();
  });

  it("throws when the previous media key equals the primary (no-op rotation)", () => {
    expect(() =>
      createStorageDriverFromEnv({
        GUARDIAN_STORAGE_DRIVER: "local",
        GUARDIAN_STORAGE_PATH: root,
        GUARDIAN_MEDIA_ENCRYPTION_KEY: "same-media-key-please-ignore-0000",
        GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS:
          "same-media-key-please-ignore-0000",
      }),
    ).toThrow("guardian-media-previous-key-equals-primary");
  });

  it("throws when a previous media key is set without a primary", () => {
    expect(() =>
      createStorageDriverFromEnv({
        GUARDIAN_STORAGE_DRIVER: "local",
        GUARDIAN_STORAGE_PATH: root,
        GUARDIAN_MEDIA_ENCRYPTION_KEY_PREVIOUS:
          "orphan-previous-key-00000000000",
      }),
    ).toThrow("guardian-media-previous-key-without-primary");
  });
});
