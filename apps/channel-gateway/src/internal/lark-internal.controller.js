const larkClient = require("../channels/lark/lark.client");

function validateConnectionId(connectionId) {
  if (
    String(connectionId) !==
    String(process.env.LARK_CONNECTION_ID)
  ) {
    const error = new Error(
      "Unknown Lark connection"
    );
    error.status = 400;
    throw error;
  }
}

async function getMembers(req, res, next) {
  try {
    const { connectionId, chatId } = req.body;

    validateConnectionId(connectionId);

    if (
      typeof chatId !== "string" ||
      !/^oc_[A-Za-z0-9_-]+$/.test(chatId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Lark chat ID"
      });
    }

    const memberIds = await larkClient.listGroupMemberIds(chatId);

    return res.json({
      success: true,
      data: {
        memberIds
      }
    });
  } catch (error) {
    next(error);
  }
}

async function sendMessage(req, res, next) {
  try {
    const {
      connectionId,
      openId,
      text
    } = req.body;

    validateConnectionId(connectionId);

    if (
      typeof openId !== "string" ||
      !/^ou_[A-Za-z0-9_-]+$/.test(openId) ||
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 3000
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Lark message payload"
      });
    }

    const result = await larkClient.sendPrivateMessage(
      openId,
      text
    );

    return res.json({
      success: true,
      data: {
        messageId: result?.message_id || null
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMembers,
  sendMessage
};
