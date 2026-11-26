const repository = require("../repositories/conversation.repository");

async function listConversations(req, res, next) {
  try {
    const conversations = await repository.listConversations();
    return res.json({ success: true, data: conversations });
  } catch (error) {
    return next(error);
  }
}

async function setReadingEnabled(req, res, next) {
  const id = String(req.params.id ?? "");
  const { enabled } = req.body || {};

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid conversation ID"
    });
  }

  if (typeof enabled !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "enabled must be a boolean"
    });
  }

  try {
    const conversation = await repository.setReadingEnabled(id, enabled);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    return res.json({
      success: true,
      message: enabled ? "Conversation reading enabled" : "Conversation reading disabled",
      data: conversation
    });
  } catch (error) {
    return next(error);
  }
}

async function setMonitoredGroupStatus(req, res, next) {
  const id = String(req.params.id ?? "");
  const { status } = req.body || {};
  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({ success: false, message: "Invalid monitored group ID" });
  }
  if (!["ACTIVE", "PAUSED", "REVOKED"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid monitored group status" });
  }
  try {
    const group = await repository.setMonitoredGroupStatus(id, status);
    if (!group) return res.status(404).json({ success: false, message: "Monitored group not found" });
    return res.json({ success: true, data: group });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listConversations, setReadingEnabled, setMonitoredGroupStatus };
