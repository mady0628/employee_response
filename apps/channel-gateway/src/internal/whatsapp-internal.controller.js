const { manager, ensureMonitoredGroup } = require("../services/whatsapp-session.service");

function validateConnectionId(value) {
  const id = String(value ?? "");
  if (!/^[1-9]\d*$/.test(id)) {
    const error = new Error("Invalid WhatsApp connection ID");
    error.status = 400;
    throw error;
  }
  return id;
}

async function getAllowedGroup(client, connectionId, groupId) {
  if (typeof groupId !== "string" || !groupId.endsWith("@g.us")) {
    const error = new Error("Invalid WhatsApp group ID");
    error.status = 400;
    throw error;
  }
  const chat = await client.getChatById(groupId);
  if (!chat?.isGroup) {
    const error = new Error("WhatsApp group not found");
    error.status = 404;
    throw error;
  }
  const monitored = await ensureMonitoredGroup({
    connectionId,
    groupId,
    groupName: chat.name
  });
  if (!monitored || monitored.status !== "ACTIVE") {
    const error = new Error("WhatsApp group is not active for monitoring");
    error.status = 403;
    throw error;
  }
  return chat;
}

async function getGroupMembers(req, res, next) {
  try {
    const connectionId = validateConnectionId(req.body?.connectionId);
    const client = manager.getConnectedClient(connectionId);
    const chat = await getAllowedGroup(client, connectionId, req.body.groupId);
    const memberIds = [...new Set((chat.participants || []).map(item => item.id?._serialized).filter(Boolean))];
    let mappings = [];
    try {
      mappings = await client.getContactLidAndPhone(memberIds);
    } catch (error) {
      console.warn("WhatsApp identity mapping unavailable for reminder membership lookup:", error.message);
    }
    const members = memberIds.map((memberId, index) => {
      const identityIds = new Set([memberId]);
      for (const id of [mappings?.[index]?.lid, mappings?.[index]?.pn]) {
        if (typeof id === "string" && id) identityIds.add(id);
      }
      return { memberId, recipientId: memberId, identityIds: [...identityIds] };
    });
    return res.json({ success: true, data: { memberIds, members } });
  } catch (error) {
    return next(error);
  }
}

async function sendReminder(req, res, next) {
  try {
    if (process.env.WA_REMINDER_ENABLED !== "true") {
      return res.status(503).json({ success: false, message: "WhatsApp reminders are disabled" });
    }
    const connectionId = validateConnectionId(req.body?.connectionId);
    const { groupId, recipientId, text } = req.body || {};
    if (typeof recipientId !== "string" || !/^[A-Za-z0-9._-]+@(c\.us|lid)$/.test(recipientId) || typeof text !== "string" || !text.trim() || text.length > 2000) {
      return res.status(400).json({ success: false, message: "Invalid reminder request" });
    }
    const client = manager.getConnectedClient(connectionId);
    const chat = await getAllowedGroup(client, connectionId, groupId);
    const isMember = (chat.participants || []).some(item => item.id?._serialized === recipientId);
    if (!isMember) return res.status(409).json({ success: false, message: "Recipient membership is no longer verified" });
    const sent = await client.sendMessage(recipientId, text);
    return res.json({ success: true, data: { messageId: sent.id?._serialized || null } });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getGroupMembers, sendReminder };
