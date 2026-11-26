async function callWhatsApp(path, body) {
  const response = await fetch(
    `${process.env.GATEWAY_SERVICE_URL}/internal/whatsapp/${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key":
          process.env.GATEWAY_INTERNAL_API_KEY
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    }
  );

  if (!response.ok) {
    const error = new Error(
      `WhatsApp internal API HTTP ${response.status}`
    );

    error.status = response.status;
    throw error;
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error("WhatsApp API failed");
  }

  return result.data;
}

async function getGroupMembers(connectionId, groupId) {
  const result = await callWhatsApp("group-members", {
    connectionId: String(connectionId),
    groupId
  });

  if (
    !Array.isArray(result.members) &&
    Array.isArray(result.memberIds)
  ) {
    return {
      ...result,
      members: result.memberIds.map(memberId => ({
        memberId,
        recipientId: memberId,
        identityIds: [memberId]
      }))
    };
  }

  return result;
}

async function sendReminder(
  connectionId,
  groupId,
  recipientId,
  text
) {
  return callWhatsApp("send-reminder", {
    connectionId: String(connectionId),
    groupId,
    recipientId,
    text
  });
}

module.exports = {
  getGroupMembers,
  sendReminder
};
