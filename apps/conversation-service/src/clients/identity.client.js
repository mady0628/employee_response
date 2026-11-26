const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();

async function resolveEmployee(platform, platformUserId) {
  const params = new URLSearchParams({
    platform,
    platformUserId: String(platformUserId)
  });

  const url = `${process.env.IDENTITY_SERVICE_URL}/api/employees/resolve?${params}`;

  const response = await fetch(url, {
    headers: {
      "x-internal-api-key": process.env.IDENTITY_INTERNAL_API_KEY
    },
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(
      `Identity Service returned ${response.status}`
    );
  }

  const result = await response.json();
  return result.data;
}

module.exports = { resolveEmployee };
