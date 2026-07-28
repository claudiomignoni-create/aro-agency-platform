import crypto from "node:crypto";

const stateTtlMs = 10 * 60 * 1000;

function base64Url(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function secret() {
  return process.env.EMAIL_TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

export function randomToken(bytes = 32) {
  return base64Url(crypto.randomBytes(bytes));
}

export function deterministicToken(namespace: string, value: string) {
  return base64Url(
    crypto
      .createHmac("sha256", encryptionKey())
      .update(`${namespace}:${value}`)
      .digest()
  );
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createPkcePair() {
  const verifier = randomToken(48);
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());

  return { challenge, verifier };
}

export function signOAuthState(payload: Record<string, string>) {
  const key = secret();
  if (!key) throw new Error("Missing EMAIL_TOKEN_ENCRYPTION_KEY or AUTH_SECRET");

  const body = base64Url(Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + stateTtlMs }), "utf8"));
  const signature = base64Url(crypto.createHmac("sha256", key).update(body).digest());

  return `${body}.${signature}`;
}

export function verifyOAuthState<T extends Record<string, unknown>>(state: string): T {
  const key = secret();
  if (!key) throw new Error("Missing EMAIL_TOKEN_ENCRYPTION_KEY or AUTH_SECRET");

  const [body, signature] = state.split(".");
  if (!body || !signature) throw new Error("Invalid OAuth state");

  const expected = base64Url(crypto.createHmac("sha256", key).update(body).digest());
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid OAuth state signature");
  }

  const payload = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
    throw new Error("Expired OAuth state");
  }

  return payload;
}

function encryptionKey() {
  const key = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("Missing EMAIL_TOKEN_ENCRYPTION_KEY");

  const maybeBase64 = Buffer.from(key, "base64");
  if (maybeBase64.length === 32) return maybeBase64;
  const maybeHex = Buffer.from(key, "hex");
  if (maybeHex.length === 32) return maybeHex;

  return crypto.createHash("sha256").update(key).digest();
}

export function encryptSecret(plainText: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1.${base64Url(iv)}.${base64Url(tag)}.${base64Url(encrypted)}`;
}

export function decryptSecret(payload: string | null | undefined) {
  if (!payload) return null;
  const [version, ivText, tagText, encryptedText] = payload.split(".");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) {
    throw new Error("Unsupported encrypted secret format");
  }

  const iv = Buffer.from(ivText.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const tag = Buffer.from(tagText.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const encrypted = Buffer.from(encryptedText.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function sanitizeError(error: unknown) {
  if (error instanceof Error) return error.message.replace(/[A-Za-z0-9_\-]{24,}/g, "[redacted]");
  return "Unknown error";
}
