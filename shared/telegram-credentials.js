const crypto = require("node:crypto");

function encryptionKey() {
  const configured = process.env.TELEGRAM_CREDENTIALS_ENCRYPTION_KEY;
  if (!configured || configured.length < 32 || configured.includes("REPLACE_")) {
    throw new Error("TELEGRAM_CREDENTIALS_ENCRYPTION_KEY must be configured with at least 32 characters");
  }
  return crypto.createHash("sha256").update(configured).digest();
}

function encrypt(value) {
  if (typeof value !== "string" || !value) throw new Error("Credential value is required");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decrypt(value) {
  const [ivPart, tagPart, ciphertextPart, ...extra] = String(value || "").split(".");
  if (!ivPart || !tagPart || !ciphertextPart || extra.length) throw new Error("Invalid encrypted credential format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function createWebhookSecret() {
  return crypto.randomBytes(32).toString("base64url");
}

module.exports = { encrypt, decrypt, fingerprint, createWebhookSecret };
