const express = require("express");
const crypto = require("node:crypto");
const rateLimit = require("../../../../../shared/rate-limit");

function secureEquals(a, b) {
  if (!a || !b) return false;

  const aHash = crypto
    .createHash("sha256")
    .update(String(a))
    .digest();

  const bHash = crypto
    .createHash("sha256")
    .update(String(b))
    .digest();

  return crypto.timingSafeEqual(aHash, bHash);
}

function startWhatsAppInternalApi(client, isReady, ensureMonitoredGroup) {
  const app = express();

  app.use(rateLimit({ max: Number(process.env.WA_INTERNAL_RATE_LIMIT || 60), name: "whatsapp-internal" }));
  app.use(express.json({ limit: "16kb" }));

  app.use((req, res, next) => {
    const expected = process.env.WA_INTERNAL_API_KEY;
    const received = req.get("x-internal-api-key");

    if (!secureEquals(received, expected)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    next();
  });

  const allowedGroups = new Set(
    (process.env.WA_GROUP_IDS || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean)
  );

  async function getAllowedGroup(groupId) {
    if (typeof groupId !== "string") {
      const error = new Error("Invalid group ID");
      error.status = 400;
      throw error;
    }

    const chat = await client.getChatById(groupId);

    if (!chat?.isGroup) {
      const error = new Error("Not a WhatsApp group");
      error.status = 400;
      throw error;
    }

    if (typeof ensureMonitoredGroup === "function") {
      const group = await ensureMonitoredGroup(chat);
      if (group && group.status !== "ACTIVE") {
        const error = new Error("Group not active");
        error.status = 403;
        throw error;
      }
    } else if (allowedGroups.size > 0 && !allowedGroups.has(groupId)) {
      const error = new Error("Group not allowed");
      error.status = 403;
      throw error;
    }

    return chat;
  }

  app.get("/health", (req, res) => {
    res.json({
      success: true,
      data: { ready: Boolean(isReady()) }
    });
  });

  app.post("/group-members", async (req, res, next) => {
    try {
      if (!isReady()) {
        return res.status(503).json({
          success: false,
          message: "WhatsApp not ready"
        });
      }

      const chat = await getAllowedGroup(
        req.body.groupId
      );

      // ID của người tham gia có thể là
      // @lid hoặc @c.us tùy phiên WhatsApp.
      const memberIds = (chat.participants || [])
        .map(p => p.id?._serialized)
        .filter(Boolean);

      let mappings = [];
      try {
        mappings = await client.getContactLidAndPhone(
          memberIds
        );
      } catch (error) {
        console.warn(
          "WhatsApp member identity mapping unavailable:",
          error.message
        );
      }

      const members = memberIds.map((memberId, index) => {
        const mapping = mappings?.[index];
        const identityIds = new Set([memberId]);

        for (const id of [mapping?.lid, mapping?.pn]) {
          if (typeof id === "string" && id.length > 0) {
            identityIds.add(id);
          }
        }

        return {
          memberId,
          recipientId: memberId,
          identityIds: [...identityIds]
        };
      });

      res.json({
        success: true,
        data: {
          memberIds: [...new Set(memberIds)],
          members
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/send-reminder", async (req, res, next) => {
    try {
      if (!isReady()) {
        return res.status(503).json({
          success: false,
          message: "WhatsApp not ready"
        });
      }

      if (process.env.WA_REMINDER_ENABLED !== "true") {
        return res.status(503).json({
          success: false,
          message: "WhatsApp reminders disabled"
        });
      }

      const { groupId, recipientId, text } = req.body;

      const chat = await getAllowedGroup(groupId);

      if (
        typeof recipientId !== "string" ||
        !/^[A-Za-z0-9._-]+@(c\.us|lid)$/.test(
          recipientId
        ) ||
        typeof text !== "string" ||
        text.length === 0 ||
        text.length > 2000
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid request"
        });
      }

      const memberIds = new Set(
        (chat.participants || [])
          .map(p => p.id?._serialized)
          .filter(Boolean)
      );

      // Bản PoC chỉ gửi khi recipientId
      // khớp chính xác ID đang ở trong group.
      if (!memberIds.has(recipientId)) {
        return res.status(409).json({
          success: false,
          message: "Recipient membership not verified"
        });
      }

      const sent = await client.sendMessage(
        recipientId,
        text
      );

      return res.json({
        success: true,
        data: {
          messageId: sent.id?._serialized || null
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, req, res, next) => {
    console.error(
      "WhatsApp internal API error:",
      error.message
    );

    res.status(error.status || 502).json({
      success: false,
      message: error.status
        ? error.message
        : "WhatsApp operation failed"
    });
  });

  const port = Number(
    process.env.WA_INTERNAL_PORT || 3013
  );

  return app.listen(
    port,
    process.env.WA_INTERNAL_HOST || "127.0.0.1",
    () => {
      console.log(
        "WhatsApp internal API listening",
        { port }
      );
    }
  );
}

module.exports = {
  startWhatsAppInternalApi
};
