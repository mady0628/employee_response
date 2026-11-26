const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();

async function verifyTelegramAccount(code, telegramUser) {
  const response = await fetch(
    `${process.env.IDENTITY_SERVICE_URL}/api/verifications/telegram`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": process.env.IDENTITY_INTERNAL_API_KEY
      },
      body: JSON.stringify({ code, telegramUser }),
      signal: AbortSignal.timeout(10000)
    }
  );

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Invalid response from Identity Service");
  }

  if (!response.ok) {
    const error = new Error(
      result.message || "Identity verification failed"
    );
    error.status = response.status;
    throw error;
  }

  return result.data;
}

module.exports = { verifyTelegramAccount };
