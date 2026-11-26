const Lark = require("@larksuiteoapi/node-sdk");
const { normalizeLarkMessage } = require("./lark.adapter");
const { normalizeLarkReaction } = require("./lark-reaction.adapter");
const { publishLarkMessage, publishLarkReaction } = require("../../publishers/lark.publisher");
const { handlePrivateMessage } = require("./lark-verification.service");

const verificationToken = process.env.LARK_VERIFICATION_TOKEN;
const encryptKey = process.env.LARK_ENCRYPT_KEY;

if (!verificationToken || verificationToken === "your_verification_token") {
  throw new Error(
    "LARK_VERIFICATION_TOKEN must be set to a non-placeholder secret"
  );
}

if (!process.env.LARK_CONNECTION_ID) {
  throw new Error(
    "LARK_CONNECTION_ID is required"
  );
}

const isEncryptKeyValid =
  encryptKey &&
  encryptKey !== "your_encrypt_key" &&
  encryptKey.trim().length > 0;

const dispatcher = new Lark.EventDispatcher({
  verificationToken,
  ...(isEncryptKeyValid ? { encryptKey } : {})
}).register({
  "im.message.receive_v1": async data => {
    // 1. Tin nhắn riêng với Lark Bot
    if (data.message?.chat_type === "p2p") {
      await handlePrivateMessage(data);
      return;
    }

    // 2. Tin nhắn group
    const event = normalizeLarkMessage(
      data,
      process.env.LARK_CONNECTION_ID
    );

    if (!event) {
      return;
    }

    await publishLarkMessage(event);

    console.log("Lark group message published", { eventId: event.eventId });
  },
  "im.message.reaction.created_v1": async data => {
    const event = normalizeLarkReaction(
      data,
      process.env.LARK_CONNECTION_ID
    );

    if (!event) return;

    await publishLarkReaction(event);

    console.log("Lark reaction published", { eventId: event.eventId });
  }
});

const sdkWebhook = Lark.adaptExpress(
  dispatcher,
  { autoChallenge: true }
);

function larkWebhook(req, res, next) {
  return sdkWebhook(req, res, next);
}

module.exports = larkWebhook;
