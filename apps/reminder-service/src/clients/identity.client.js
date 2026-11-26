const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();

async function getVerifiedEmployees() {
  const response = await fetch(
    `${process.env.IDENTITY_SERVICE_URL}/api/verifications/employees`,
    {
      headers: {
        "x-internal-api-key": process.env.IDENTITY_INTERNAL_API_KEY
      },
      signal: AbortSignal.timeout(5000)
    }
  );

  if (!response.ok) {
    throw new Error(
      `Identity Service returned ${response.status}`
    );
  }

  const result = await response.json();

  if (!result.success || !Array.isArray(result.data)) {
    throw new Error("Invalid employee list response");
  }

  return result.data;
}

module.exports = { getVerifiedEmployees };
