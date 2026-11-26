const { manager } = require("../services/whatsapp-session.service");
const { setDesiredState } = require("../clients/config.client");

const configServiceUrl =
  process.env.CONFIG_SERVICE_URL || "http://127.0.0.1:3002";
const configApiKey =
  process.env.CONFIG_INTERNAL_API_KEY ||
  process.env.GATEWAY_INTERNAL_API_KEY;

async function getWhatsAppConnection(id) {
  if (!/^[1-9]\d*$/.test(String(id))) return null;
  try {
    const res = await fetch(
      `${configServiceUrl}/internal/admin/connections/${id}`,
      {
        headers: {
          "x-internal-api-key": configApiKey
        },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      const error = new Error(`Config Service returned ${res.status}`);
      error.status = 502;
      throw error;
    }

    const data = await res.json();
    if (data?.success && data?.data?.platform === "WHATSAPP") {
      return data.data;
    }
  } catch (error) {
    console.error("[WhatsApp Admin Controller] getWhatsAppConnection failed:", error.message);
    if (error.status) throw error;
    const upstreamError = new Error("Config Service is unavailable");
    upstreamError.status = 502;
    throw upstreamError;
  }
  return null;
}

async function assertWhatsAppConnection(id) {
  const connection = await getWhatsAppConnection(id);
  if (!connection) {
    const error = new Error("WhatsApp connection not found");
    error.status = 404;
    throw error;
  }
  return connection;
}

async function create(req, res, next) {
  try {
    const { displayName } = req.body || {};

    const response = await fetch(
      `${configServiceUrl}/internal/admin/connections/whatsapp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": configApiKey
        },
        body: JSON.stringify({ displayName }),
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      throw new Error(`Config Service returned ${response.status}`);
    }

    const result = await response.json();
    const newConnection = result.data;

    return res.status(201).json({
      success: true,
      data: newConnection
    });
  } catch (error) {
    next(error);
  }
}

async function start(req, res, next) {
  try {
    const connection = await assertWhatsAppConnection(req.params.id);

    // 1. Cập nhật trạng thái mong muốn RUNNING lên Config Service
    await setDesiredState(connection.id, "RUNNING");

    // 2. Khởi tạo phiên trong Session Manager
    const result = await manager.start(
      connection.id,
      connection.session_generation || 1
    );

    return res.status(202).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function runtime(req, res, next) {
  try {
    await assertWhatsAppConnection(req.params.id);
    return res.json({
      success: true,
      data: manager.getStatus(req.params.id)
    });
  } catch (error) {
    next(error);
  }
}

async function stop(req, res, next) {
  try {
    const connection = await assertWhatsAppConnection(req.params.id);

    // 1. Cập nhật desired_state = STOPPED lên Config Service
    await setDesiredState(connection.id, "STOPPED");

    // 2. Dừng WhatsApp Client thông qua Session Manager (có ConnectionLock và destroy)
    await manager.stop(req.params.id);

    return res.json({
      success: true,
      message: "Session stopped"
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const connection = await assertWhatsAppConnection(req.params.id);

    // 1. Đặt desired_state = STOPPED
    await setDesiredState(connection.id, "STOPPED");

    // 2. Đăng xuất phiên và dọn dẹp Chromium
    await manager.logout(req.params.id, connection.session_generation || 1);

    return res.json({
      success: true,
      message: "Session logged out"
    });
  } catch (error) {
    next(error);
  }
}

async function updateDesiredState(req, res, next) {
  try {
    const { desiredState } = req.body || {};
    if (!["RUNNING", "STOPPED"].includes(desiredState)) {
      return res.status(400).json({
        success: false,
        message: "Invalid desired state. Must be RUNNING or STOPPED"
      });
    }

    const updated = await setDesiredState(req.params.id, desiredState);
    return res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  start,
  runtime,
  stop,
  logout,
  updateDesiredState
};
