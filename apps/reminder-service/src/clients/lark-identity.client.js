async function getVerifiedLarkEmployees() {
  const response = await fetch(
    `${process.env.IDENTITY_SERVICE_URL}/api/verifications/lark/employees`,
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
      `Identity Service returned ${response.status}`
    );
  }

  const result = await response.json();

  if (
    !result.success ||
    !Array.isArray(result.data)
  ) {
    throw new Error(
      "Invalid Lark employees response"
    );
  }

  return result.data;
}

module.exports = {
  getVerifiedLarkEmployees
};
