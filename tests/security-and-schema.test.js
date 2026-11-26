const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("internal service middleware rejects missing or incorrect keys and accepts the correct key", () => {
  const cases = [
    ["identity-service", "IDENTITY_INTERNAL_API_KEY", "../apps/identity-service/src/middlewares/internal-auth.middleware"],
    ["config-service", "CONFIG_INTERNAL_API_KEY", "../apps/config-service/src/middlewares/internal-auth.middleware"],
    ["sla-service", "GATEWAY_INTERNAL_API_KEY", "../apps/sla-service/src/middlewares/internal-auth.middleware"],
    ["conversation-service", "CONVERSATION_ADMIN_API_KEY", "../apps/conversation-service/src/middlewares/conversation-admin-auth"]
  ];
  const previous = {};
  for (const [, key] of cases) previous[key] = process.env[key];
  try {
    for (const [name, key, relativePath] of cases) {
      const middleware = require(relativePath);
      const value = `${name}-secret`;
      process.env[key] = value;
      const invoke = received => {
        const res = responseRecorder();
        let next = false;
        middleware({ get: () => received }, res, () => { next = true; });
        return { res, next };
      };
      assert.equal(invoke(undefined).res.statusCode, 401, `${name} should reject missing key`);
      assert.equal(invoke("incorrect").res.statusCode, 401, `${name} should reject invalid key`);
      assert.equal(invoke(value).next, true, `${name} should accept valid key`);
    }
  } finally {
    for (const [, key] of cases) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("admin settings handler returns the SLA policy payload", async () => {
  const handlers = require("../apps/channel-gateway/src/controllers/admin-operations.controller");
  const previous = {
    url: process.env.SLA_SERVICE_URL,
    key: process.env.GATEWAY_INTERNAL_API_KEY,
    fetch: global.fetch
  };
  const policy = {
    first_response_minutes: 10,
    reminder_interval_minutes: 7,
    new_sla_gap_minutes: 5
  };
  try {
    process.env.SLA_SERVICE_URL = "http://sla.test";
    process.env.GATEWAY_INTERNAL_API_KEY = "test-gateway-key";
    global.fetch = async (url, options) => {
      assert.equal(url, "http://sla.test/internal/admin/settings");
      assert.equal(options.headers["x-internal-api-key"], "test-gateway-key");
      return { ok: true, status: 200, json: async () => ({ success: true, data: policy }) };
    };
    const res = responseRecorder();
    await handlers.getSettings({}, res, error => { throw error; });
    assert.deepEqual(res.body, { success: true, data: policy });
  } finally {
    if (previous.url === undefined) delete process.env.SLA_SERVICE_URL;
    else process.env.SLA_SERVICE_URL = previous.url;
    if (previous.key === undefined) delete process.env.GATEWAY_INTERNAL_API_KEY;
    else process.env.GATEWAY_INTERNAL_API_KEY = previous.key;
    global.fetch = previous.fetch;
  }
});

test("database schema contains final columns and upgrades existing SLA policy tables", () => {
  const schemaPath = path.join(__dirname, "../database/schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  const initializer = fs.readFileSync(path.join(__dirname, "../database/init.js"), "utf8");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS channel_connections/i);
  for (const column of [
    "connected_account_id", "connected_phone", "session_generation", "connected_at",
    "runtime_instance_id", "runtime_heartbeat_at", "desired_state", "account_changed_at",
    "display_name", "is_enabled", "last_connected_at", "last_disconnected_at", "last_error"
  ]) assert.match(schema, new RegExp(`\\b${column}\\b`, "i"), `missing ${column}`);
  assert.match(schema, /ALTER\s+TABLE\s+sla_policy_settings\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+new_sla_gap_minutes/i);
  assert.match(schema, /DROP\s+TABLE\s+IF\s+EXISTS\s+whatsapp_group_participants/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS sla_policy_settings/i);
  assert.match(schema, /new_sla_gap_minutes INTEGER NOT NULL DEFAULT 5/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS telegram_bots/i);
  assert.match(schema, /bot_token_ciphertext TEXT NOT NULL/i);
  assert.match(schema, /webhook_secret_ciphertext TEXT NOT NULL/i);
  assert.match(initializer, /schemaSql/);
  assert.match(initializer, /INSERT INTO sla_policy_settings/i);
  assert.equal(fs.existsSync(path.join(__dirname, "../database/migrations")), false);
});

test("each backend workspace exposes a production start command", () => {
  const appsDir = path.join(__dirname, "../apps");
  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "admin-dashboard") continue;
    const manifest = JSON.parse(fs.readFileSync(path.join(appsDir, entry.name, "package.json"), "utf8"));
    assert.equal(typeof manifest.scripts?.start, "string", `${entry.name} is missing a start script`);
  }
});
