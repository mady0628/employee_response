async function getVerifiedWhatsAppEmployees() {
  const response = await fetch(
    `${process.env.IDENTITY_SERVICE_URL}/api/verifications/whatsapp/employees`,
    {
      headers: {
        "x-internal-api-key":
          process.env.IDENTITY_INTERNAL_API_KEY
      },
      signal: AbortSignal.timeout(5000)
    }
  );

  if (!response.ok) {
    throw new Error(
      `Identity API HTTP ${response.status}`
    );
  }

  const result = await response.json();

  if (
    result.success !== true ||
    !Array.isArray(result.data)
  ) {
    throw new Error(
      "Invalid Identity response"
    );
  }

  return result.data;
}

module.exports = {
  getVerifiedWhatsAppEmployees
};
