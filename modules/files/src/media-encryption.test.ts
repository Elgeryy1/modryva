import { describe, expect, it } from "vitest";
import {
  decryptMediaBuffer,
  EncryptingObjectStorageDriver,
  encryptMediaBuffer,
} from "./media-encryption.js";
import type { ObjectStorageDriver, PutObjectInput } from "./object-storage.js";

const secret = "test-media-encryption-key-please-ignore";

describe("encryptMediaBuffer / decryptMediaBuffer", () => {
  it("round-trips arbitrary binary data exactly", () => {
    const original = Buffer.from([0, 1, 2, 255, 254, 253, 128, 64]);
    const encrypted = encryptMediaBuffer(original, secret);
    const result = decryptMediaBuffer(encrypted, secret);
    expect(result.ok).toBe(true);
    expect(result.ok && result.data.equals(original)).toBe(true);
  });

  it("produces ciphertext that does not contain the plaintext bytes", () => {
    const original = Buffer.from("this is a totally real video file", "utf8");
    const encrypted = encryptMediaBuffer(original, secret);
    expect(encrypted.includes(original)).toBe(false);
  });

  it("produces different ciphertext for the same input on each call (random IV)", () => {
    const original = Buffer.from("same input twice");
    const a = encryptMediaBuffer(original, secret);
    const b = encryptMediaBuffer(original, secret);
    expect(a.equals(b)).toBe(false);
  });

  it("fails to decrypt with the wrong key", () => {
    const encrypted = encryptMediaBuffer(Buffer.from("secret media"), secret);
    const result = decryptMediaBuffer(encrypted, "a-completely-different-key");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe("auth-failed");
  });

  it("reports malformed for a buffer too short to contain an IV+tag", () => {
    const result = decryptMediaBuffer(Buffer.from([1, 2, 3]), secret);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe("malformed");
  });

  it("detects tampering with the ciphertext (GCM auth tag)", () => {
    const encrypted = encryptMediaBuffer(
      Buffer.from("integrity check"),
      secret,
    );
    const tampered = Buffer.from(encrypted);
    const lastIndex = tampered.length - 1;
    tampered[lastIndex] = (tampered[lastIndex] ?? 0) ^ 0xff;
    const result = decryptMediaBuffer(tampered, secret);
    expect(result.ok).toBe(false);
  });
});

const fakeDriver = (): ObjectStorageDriver & {
  readonly store: Map<string, Buffer>;
} => {
  const store = new Map<string, Buffer>();
  return {
    kind: "local",
    store,
    async put(input: PutObjectInput) {
      store.set(input.key, input.data);
    },
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async delete(key: string) {
      store.delete(key);
    },
    async exists(key: string) {
      return store.has(key);
    },
  };
};

describe("EncryptingObjectStorageDriver", () => {
  it("stores ciphertext in the inner driver, never the original bytes", async () => {
    const inner = fakeDriver();
    const driver = new EncryptingObjectStorageDriver(inner, secret);
    const original = Buffer.from("a captured face video, allegedly");

    await driver.put({ key: "k1", data: original, contentType: "video/mp4" });

    const rawStored = inner.store.get("k1");
    expect(rawStored).toBeDefined();
    expect(rawStored?.includes(original)).toBe(false);
  });

  it("returns the exact original bytes on get, transparently decrypting", async () => {
    const inner = fakeDriver();
    const driver = new EncryptingObjectStorageDriver(inner, secret);
    const original = Buffer.from("round trip through the decorator");

    await driver.put({ key: "k2", data: original, contentType: "video/mp4" });
    const read = await driver.get("k2");

    expect(read?.equals(original)).toBe(true);
  });

  it("returns null for a missing key without touching decryption", async () => {
    const driver = new EncryptingObjectStorageDriver(fakeDriver(), secret);
    expect(await driver.get("missing")).toBeNull();
  });

  it("fails closed (returns null, never throws or leaks ciphertext) when the key is wrong", async () => {
    const inner = fakeDriver();
    const driver = new EncryptingObjectStorageDriver(inner, secret);
    await driver.put({
      key: "k3",
      data: Buffer.from("sensitive"),
      contentType: "video/mp4",
    });

    const wrongKeyDriver = new EncryptingObjectStorageDriver(
      inner,
      "wrong-key",
    );
    await expect(wrongKeyDriver.get("k3")).resolves.toBeNull();
  });

  it("passes delete and exists straight through to the inner driver", async () => {
    const inner = fakeDriver();
    const driver = new EncryptingObjectStorageDriver(inner, secret);
    await driver.put({
      key: "k4",
      data: Buffer.from("x"),
      contentType: "text/plain",
    });
    expect(await driver.exists("k4")).toBe(true);
    await driver.delete("k4");
    expect(await driver.exists("k4")).toBe(false);
  });

  it("exposes the inner driver's kind", () => {
    const inner = fakeDriver();
    const driver = new EncryptingObjectStorageDriver(inner, secret);
    expect(driver.kind).toBe("local");
  });
});

describe("EncryptingObjectStorageDriver — key rotation (dual-read)", () => {
  const primary = "new-primary-media-key-please-ignore-01";
  const previous = "old-previous-media-key-please-ignore-2";

  it("reads media written with the PREVIOUS key during the rotation window", async () => {
    const inner = fakeDriver();
    // An object captured before the switch: ciphertext under the OLD key.
    const original = Buffer.from("captured before the media-key rotation");
    inner.store.set("old", encryptMediaBuffer(original, previous));

    const rotating = new EncryptingObjectStorageDriver(inner, primary, previous);
    expect((await rotating.get("old"))?.equals(original)).toBe(true);
  });

  it("reads media written with the PRIMARY key", async () => {
    const inner = fakeDriver();
    const rotating = new EncryptingObjectStorageDriver(inner, primary, previous);
    const original = Buffer.from("captured after the switch");
    await rotating.put({ key: "new", data: original, contentType: "video/mp4" });
    expect((await rotating.get("new"))?.equals(original)).toBe(true);
  });

  it("writes EXCLUSIVELY with the primary key", async () => {
    const inner = fakeDriver();
    const rotating = new EncryptingObjectStorageDriver(inner, primary, previous);
    const original = Buffer.from("written during the window");
    await rotating.put({ key: "w", data: original, contentType: "video/mp4" });

    // A primary-only reader (post-rotation, previous removed) reads new writes.
    const primaryOnly = new EncryptingObjectStorageDriver(inner, primary);
    expect((await primaryOnly.get("w"))?.equals(original)).toBe(true);
    // The previous key alone must NOT decrypt a primary write.
    const previousOnly = new EncryptingObjectStorageDriver(inner, previous);
    expect(await previousOnly.get("w")).toBeNull();
  });

  it("STOPS accepting old-key media once the previous key is removed (fails closed)", async () => {
    const inner = fakeDriver();
    const original = Buffer.from("must become unreadable after retirement");
    inner.store.set("old", encryptMediaBuffer(original, previous));

    // During the window: readable via the previous key.
    const rotating = new EncryptingObjectStorageDriver(inner, primary, previous);
    expect((await rotating.get("old"))?.equals(original)).toBe(true);

    // After retiring the previous key: primary-only can no longer read it.
    const retired = new EncryptingObjectStorageDriver(inner, primary);
    expect(await retired.get("old")).toBeNull();
  });

  it("returns null (never throws) when neither primary nor previous can decrypt", async () => {
    const inner = fakeDriver();
    inner.store.set(
      "x",
      encryptMediaBuffer(Buffer.from("data"), "a-third-unrelated-key-000"),
    );
    const rotating = new EncryptingObjectStorageDriver(inner, primary, previous);
    await expect(rotating.get("x")).resolves.toBeNull();
  });

  it("does not retry the previous key on a MALFORMED object (no wasted fallback)", async () => {
    const inner = fakeDriver();
    inner.store.set("short", Buffer.from([1, 2, 3])); // too short for iv+tag
    const rotating = new EncryptingObjectStorageDriver(inner, primary, previous);
    await expect(rotating.get("short")).resolves.toBeNull();
  });
});
