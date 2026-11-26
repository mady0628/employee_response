const CONFIG_URL = process.env.CONFIG_SERVICE_URL || "http://127.0.0.1:3002";
const CONFIG_KEY =
  process.env.CONFIG_INTERNAL_API_KEY ||
  process.env.GATEWAY_INTERNAL_API_KEY;

async function callConfig(path, options = {}) {
  const response = await fetch(
    `${CONFIG_URL}${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": CONFIG_KEY,
        ...options.headers
      },
      signal: AbortSignal.timeout(5000)
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    const error = new Error(
      result.message || "Config Service error"
    );

    error.status = response.status;
    throw error;
  }

  return result.data;
}

async function getWhatsAppConnection(id) {
  const data = await callConfig(
    `/internal/admin/connections/${id}`
  );

  if (data.platform !== "WHATSAPP") {
    const error = new Error(
      "Connection is not WhatsApp"
    );

    error.status = 400;
    throw error;
  }

  return data;
}

async function setDesiredState(id, desiredState) {
  return callConfig(
    `/internal/admin/connections/${id}/desired-state`,
    {
      method: "PATCH",
      body: JSON.stringify({ desiredState })
    }
  );
}

async function claimRuntime({ connectionId, generation, runtimeInstanceId }) {
  return callConfig(
    `/internal/connections/${connectionId}/claim-runtime`,
    {
      method: "POST",
      body: JSON.stringify({ generation, runtimeInstanceId })
    }
  );
}

async function getRunnableWhatsAppConnections() {
  return callConfig(`/internal/admin/connections/runnable/whatsapp`);
}

async function getTelegramBots() {
  return callConfig("/internal/admin/telegram-bots");
}

async function createTelegramBot(bot) {
  return callConfig("/internal/admin/telegram-bots", {
    method: "POST",
    body: JSON.stringify(bot)
  });
}

async function getTelegramBotRuntime(id) {
  return callConfig(`/internal/telegram-bots/${encodeURIComponent(id)}/runtime`);
}

async function updateTelegramBotStatus(id, status, errorMessage = null) {
  return callConfig(`/internal/telegram-bots/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, errorMessage })
  });
}

async function updateConnectionRuntime({
  connectionId,
  generation,
  status,
  details = {}
}) {
  return callConfig(
    `/internal/connections/${connectionId}/runtime`,
    {
      method: "PATCH",
      body: JSON.stringify({
        generation,
        status,
        accountId: details.accountId ?? null,
        errorMessage:
          details.error || details.reason || null,
        runtimeInstanceId: details.runtimeInstanceId ?? null
      })
    }
  );
}

async function heartbeatRuntime({ connectionId, generation, runtimeInstanceId }) {
  return callConfig(
    `/internal/connections/${connectionId}/runtime/heartbeat`,
    {
      method: "PATCH",
      body: JSON.stringify({ generation, runtimeInstanceId })
    }
  );
}

module.exports = {
  callConfig,
  getWhatsAppConnection,
  setDesiredState,
  claimRuntime,
  getRunnableWhatsAppConnections,
  getTelegramBots,
  createTelegramBot,
  getTelegramBotRuntime,
  updateTelegramBotStatus,
  updateConnectionRuntime,
  heartbeatRuntime
};
