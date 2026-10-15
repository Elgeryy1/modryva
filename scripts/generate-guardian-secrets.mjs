import { randomBytes } from "node:crypto";

// Generates strong random values for GUARDIAN_SESSION_SECRET and
// GUARDIAN_MEDIA_ENCRYPTION_KEY. Never prints an existing secret — only fresh
// random ones — so it's safe to run and paste into .env / your secrets manager.

const secret = (bytes) => randomBytes(bytes).toString("base64url");

console.log(`GUARDIAN_SESSION_SECRET=${secret(32)}`);
console.log(`GUARDIAN_MEDIA_ENCRYPTION_KEY=${secret(32)}`);
