import { createHash, createHmac } from "node:crypto";

/**
 * Minimal AWS Signature Version 4 request signer, hand-rolled instead of
 * pulling in @aws-sdk/client-s3 — mirrors this repo's existing convention of
 * talking to external APIs over raw fetch (see packages/telegram/src/gateway.ts)
 * rather than adopting a heavy provider SDK.
 *
 * NOTE: this has been reviewed against the publicly documented SigV4
 * algorithm but has NOT been exercised against a live S3/MinIO endpoint in
 * this session — verify with a real bucket before relying on it in
 * production (see docs/GUARDIAN_TELEGRAM_TEST.md). Swapping in
 * @aws-sdk/client-s3 behind the same ObjectStorageDriver interface is a
 * drop-in alternative if you'd rather not run hand-rolled signing in prod.
 */

const EMPTY_BODY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export interface S3SignerConfig {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
  /** Full endpoint, e.g. "https://s3.eu-west-1.amazonaws.com" or a MinIO URL. */
  readonly endpoint: string;
}

export interface SignedRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
}

const amzDate = (date: Date): { amzDate: string; dateStamp: string } => {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/gu, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
};

const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac("sha256", key).update(data, "utf8").digest();

const sha256Hex = (data: string | Buffer): string =>
  createHash("sha256").update(data).digest("hex");

const uriEncode = (value: string, isPathSegment: boolean): string =>
  encodeURIComponent(value)
    .replace(
      /[!'()*]/gu,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    // S3 path segments keep literal "/" (already split before encoding).
    .replace(/%2F/gu, isPathSegment ? "/" : "%2F");

const canonicalUri = (key: string): string =>
  `/${key
    .split("/")
    .map((segment) => uriEncode(segment, false))
    .join("/")}`;

const deriveSigningKey = (
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer => {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
};

/**
 * Signs a request for the S3 `object` API (put/get/delete on a single key).
 * `payloadHash` should be EMPTY_BODY_SHA256 for GET/DELETE, "UNSIGNED-PAYLOAD"
 * for PUT (S3 explicitly allows this to avoid hashing the whole body up
 * front), or a real sha256 hex digest if you want the body itself signed.
 */
export const signS3ObjectRequest = (
  config: S3SignerConfig,
  input: {
    readonly method: "GET" | "PUT" | "DELETE" | "HEAD";
    readonly bucket: string;
    readonly key: string;
    readonly payloadHash?: string;
    readonly contentType?: string;
    readonly now?: Date;
  },
): SignedRequest => {
  const service = "s3";
  const now = input.now ?? new Date();
  const { amzDate: xAmzDate, dateStamp } = amzDate(now);
  const endpointUrl = new URL(config.endpoint);
  const host = `${input.bucket}.${endpointUrl.host}`;
  const payloadHash = input.payloadHash ?? EMPTY_BODY_SHA256;

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": xAmzDate,
    ...(input.contentType ? { "content-type": input.contentType } : {}),
  };

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name]}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalRequest = [
    input.method,
    canonicalUri(input.key),
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    xAmzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = deriveSigningKey(
    config.secretAccessKey,
    dateStamp,
    config.region,
    service,
  );
  const signature = hmac(signingKey, stringToSign).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${host}${canonicalUri(input.key)}`,
    method: input.method,
    headers: { ...headers, authorization },
  };
};

export const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
export { EMPTY_BODY_SHA256 };
