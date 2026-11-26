const test = require("node:test");
const assert = require("node:assert/strict");

const sanitizeErrorMessage = require("../shared/sanitize-error-message");
const validateProductionEnv = require("../shared/validate-production-env");
const configureTrustProxy = require("../shared/trust-proxy");
const createRateLimit = require("../shared/rate-limit");
const telegramCredentials = require("../shared/telegram-credentials");
const consoleMethods = Object.fromEntries(
  ["log", "info", "warn", "error", "debug"].map(level => [level, console[level]])
);
const { sanitize: sanitizeLog } = require("../shared/logger");
for (const [level, method] of Object.entries(consoleMethods)) console[level] = method;

test("error messages redact credentials, Telegram tokens, IDs and contacts", () => {
  const result = sanitizeErrorMessage(
    "token=abc123 email jane@example.com phone +1 555 123 4567 bot123456:abcdefghijklmnopqrstuvwxyz"
  );
  assert.match(result, /token=\[REDACTED\]/);
  assert.match(result, /\[REDACTED_EMAIL\]/);
  assert.match(result, /\[REDACTED_PHONE\]/);
  assert.match(result, /bot\[REDACTED\]/);
});

test("error message sanitization respects the requested maximum length", () => {
  assert.equal(sanitizeErrorMessage("abcdefgh", 4), "abcd");
});

test("production environment accepts sufficiently long configured secrets", () => {
  const previous = { nodeEnv: process.env.NODE_ENV, API_KEY: process.env.API_KEY };
  try {
    process.env.NODE_ENV = "production";
    process.env.API_KEY = "a".repeat(40);
    assert.doesNotThrow(() => validateProductionEnv(["API_KEY"]));
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.API_KEY === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = previous.API_KEY;
  }
});

test("production environment rejects missing, placeholder and weak secrets", () => {
  const previous = { nodeEnv: process.env.NODE_ENV, API_KEY: process.env.API_KEY };
  try {
    process.env.NODE_ENV = "production";
    delete process.env.API_KEY;
    assert.throws(() => validateProductionEnv(["API_KEY"]), /API_KEY/);
    process.env.API_KEY = "REPLACE_WITH_SECRET_012345678901234567890";
    assert.throws(() => validateProductionEnv(["API_KEY"]), /API_KEY/);
    process.env.API_KEY = "short";
    assert.throws(() => validateProductionEnv(["API_KEY"]), /API_KEY/);
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.API_KEY === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = previous.API_KEY;
  }
});

test("trust proxy accepts configured hop counts and rejects invalid values", () => {
  const previous = process.env.TRUST_PROXY_HOPS;
  try {
    const settings = [];
    process.env.TRUST_PROXY_HOPS = "2";
    configureTrustProxy({ set: (...args) => settings.push(args) });
    assert.deepEqual(settings, [["trust proxy", 2]]);
    process.env.TRUST_PROXY_HOPS = "6";
    assert.throws(() => configureTrustProxy({ set() {} }), /TRUST_PROXY_HOPS/);
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = previous;
  }
});

test("rate limiter permits requests up to the limit and rejects the next one", () => {
  const limiter = createRateLimit({ max: 2, windowMs: 60000, name: "test-shared" });
  const makeResponse = () => ({
    headers: {},
    statusCode: 200,
    set(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  });
  const invoke = () => {
    const response = makeResponse();
    let continued = false;
    limiter({ ip: "192.0.2.99", socket: {} }, response, () => { continued = true; });
    return { response, continued };
  };

  assert.equal(invoke().continued, true);
  assert.equal(invoke().continued, true);
  const blocked = invoke();
  assert.equal(blocked.continued, false);
  assert.equal(blocked.response.statusCode, 429);
  assert.equal(blocked.response.headers["Retry-After"] !== undefined, true);
});

test("logger redacts sensitive keys and hashes event IDs", () => {
  const result = sanitizeLog({
    eventId: "telegram:connection:chat:message",
    message: "private contents",
    email: "user@example.com",
    safe: "retained"
  });
  assert.notEqual(result.eventId, "telegram:connection:chat:message");
  assert.equal(result.message, "[REDACTED]");
  assert.equal(result.email, "[REDACTED]");
  assert.equal(result.safe, "retained");
});

test("Telegram credentials encrypt and decrypt with authenticated ciphertext", () => {
  const previous = process.env.TELEGRAM_CREDENTIALS_ENCRYPTION_KEY;
  process.env.TELEGRAM_CREDENTIALS_ENCRYPTION_KEY = "test-key-".repeat(5);
  try {
    const secret = "123456789:telegram-token-value-that-must-not-be-stored-plaintext";
    const ciphertext = telegramCredentials.encrypt(secret);
    assert.notEqual(ciphertext, secret);
    assert.equal(telegramCredentials.decrypt(ciphertext), secret);
    const [iv, tag, data] = ciphertext.split(".");
    const alteredData = Buffer.from(data, "base64url");
    alteredData[0] ^= 1;
    const tampered = `${iv}.${tag}.${alteredData.toString("base64url")}`;
    assert.throws(() => telegramCredentials.decrypt(tampered));
    assert.equal(telegramCredentials.fingerprint(secret).length, 64);
    assert.equal(telegramCredentials.createWebhookSecret().length >= 40, true);
    process.env.TELEGRAM_CREDENTIALS_ENCRYPTION_KEY = "REPLACE_WITH_A_KNOWN_EXAMPLE_KEY_VALUE";
    assert.throws(() => telegramCredentials.encrypt(secret), /must be configured/);
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.TELEGRAM_CREDENTIALS_ENCRYPTION_KEY = previous;
  }
});
