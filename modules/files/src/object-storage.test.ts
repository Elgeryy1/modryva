import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateObjectKey,
  LocalObjectStorageDriver,
  S3ObjectStorageDriver,
} from "./object-storage.js";

describe("generateObjectKey", () => {
  it("is not predictable and does not leak the prefix into a fixed pattern", () => {
    const a = generateObjectKey("guardian/sessions", "mp4");
    const b = generateObjectKey("guardian/sessions", "mp4");
    expect(a).not.toBe(b);
    expect(a.startsWith("guardian/sessions/")).toBe(true);
    expect(a.endsWith(".mp4")).toBe(true);
  });

  it("strips unsafe characters from the prefix", () => {
    const key = generateObjectKey("../../etc", "mp4");
    expect(key).not.toContain("..");
  });
});

describe("LocalObjectStorageDriver", () => {
  let root: string;
  let driver: LocalObjectStorageDriver;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "guardian-storage-"));
    driver = new LocalObjectStorageDriver(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes and reads back the exact bytes", async () => {
    const data = Buffer.from("hello guardian");
    await driver.put({
      key: "a/b/c.bin",
      data,
      contentType: "application/octet-stream",
    });
    const read = await driver.get("a/b/c.bin");
    expect(read?.equals(data)).toBe(true);
  });

  it("reports existence correctly", async () => {
    expect(await driver.exists("missing.bin")).toBe(false);
    await driver.put({
      key: "present.bin",
      data: Buffer.from("x"),
      contentType: "text/plain",
    });
    expect(await driver.exists("present.bin")).toBe(true);
  });

  it("returns null for a missing key instead of throwing", async () => {
    expect(await driver.get("nope.bin")).toBeNull();
  });

  it("delete is idempotent", async () => {
    await driver.put({
      key: "gone.bin",
      data: Buffer.from("x"),
      contentType: "text/plain",
    });
    await driver.delete("gone.bin");
    expect(await driver.exists("gone.bin")).toBe(false);
    await expect(driver.delete("gone.bin")).resolves.toBeUndefined();
  });

  it("rejects a key that tries to escape the storage root via path traversal", async () => {
    await expect(
      driver.put({
        key: "../../outside.bin",
        data: Buffer.from("x"),
        contentType: "text/plain",
      }),
    ).rejects.toThrow("path-traversal-rejected");
  });

  it("leaves no stray temp file behind when the write/rename fails", async () => {
    // Forces the final rename to fail: "clash" exists as a DIRECTORY, so
    // renaming a temp file onto that path fails (can't rename a file over a
    // non-empty/directory target).
    const { mkdir: mkdirFs, readdir } = await import("node:fs/promises");
    await mkdirFs(path.join(root, "clash"));

    await expect(
      driver.put({
        key: "clash",
        data: Buffer.from("x"),
        contentType: "text/plain",
      }),
    ).rejects.toThrow();

    const entries = await readdir(root);
    const leftoverTemp = entries.filter((e) => e.includes(".tmp-"));
    expect(leftoverTemp).toEqual([]);
  });
});

describe("S3ObjectStorageDriver", () => {
  const config = {
    accessKeyId: "AKIA",
    secretAccessKey: "secret",
    region: "eu-west-1",
    endpoint: "https://s3.eu-west-1.amazonaws.com",
    bucket: "guardian-media",
  };
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("PUTs the exact bytes to the signed virtual-hosted URL", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock;
    const driver = new S3ObjectStorageDriver(config);

    await driver.put({
      key: "k.mp4",
      data: Buffer.from("bytes"),
      contentType: "video/mp4",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://guardian-media.s3.eu-west-1.amazonaws.com/k.mp4",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("returns null on a 404 GET instead of throwing", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 404 }));
    const driver = new S3ObjectStorageDriver(config);
    expect(await driver.get("missing.mp4")).toBeNull();
  });

  it("throws on a non-ok, non-404 response", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 }));
    const driver = new S3ObjectStorageDriver(config);
    await expect(driver.get("k.mp4")).rejects.toThrow();
  });

  it("treats DELETE of an already-missing object as success", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 404 }));
    const driver = new S3ObjectStorageDriver(config);
    await expect(driver.delete("k.mp4")).resolves.toBeUndefined();
  });
});
