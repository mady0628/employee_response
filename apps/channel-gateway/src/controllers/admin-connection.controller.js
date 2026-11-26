async function listConnections(req, res, next) {
  try {
    const configServiceUrl =
      process.env.CONFIG_SERVICE_URL || "http://127.0.0.1:3002";
    const apiKey =
      process.env.CONFIG_INTERNAL_API_KEY ||
      process.env.GATEWAY_INTERNAL_API_KEY;

    const response = await fetch(
      `${configServiceUrl}/internal/admin/connections`,
      {
        headers: {
          "x-internal-api-key": apiKey
        },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      throw new Error(`Config Service returned ${response.status}`);
    }

    const result = await response.json();
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

async function createWhatsApp(req, res, next) {
  try {
    const displayName = req.body?.displayName;

    if (
      typeof displayName !== "string" ||
      displayName.trim().length < 3 ||
      displayName.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: "Tên kết nối không hợp lệ"
      });
    }

    const configServiceUrl =
      process.env.CONFIG_SERVICE_URL || "http://127.0.0.1:3002";
    const apiKey =
      process.env.CONFIG_INTERNAL_API_KEY ||
      process.env.GATEWAY_INTERNAL_API_KEY;

    const response = await fetch(
      `${configServiceUrl}/internal/admin/connections/whatsapp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": apiKey
        },
        body: JSON.stringify({
          displayName: displayName.trim()
        }),
        signal: AbortSignal.timeout(5000)
      }
    );

    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listConnections,
  createWhatsApp
};
