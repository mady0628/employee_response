const repository = require(
  "../repositories/lark-conversation.repository"
);

async function resolveLarkEmployee(openId) {
  const params = new URLSearchParams({
    platform: "LARK",
    platformUserId: openId
  });

  const response = await fetch(
    `${process.env.IDENTITY_SERVICE_URL}/api/employees/resolve?${params}`,
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
      `Identity Service returned HTTP ${response.status}`
    );
  }

  const body = await response.json();

  if (body.success !== true) {
    throw new Error("Invalid Identity Service response");
  }

  return body.data || null;
}

async function processLarkMessage(event) {
  let senderType = "CUSTOMER";
  let employeeId = null;

  if (event.sender.isBot) {
    senderType = "BOT";
  } else {
    const employee = await resolveLarkEmployee(
      event.sender.externalId
    );

    if (employee) {
      senderType = "EMPLOYEE";
      employeeId = employee.id;
    }
  }

  return repository.saveLarkMessage({
    event,
    senderType,
    employeeId
  });
}

module.exports = {
  processLarkMessage,
  resolveLarkEmployee
};
