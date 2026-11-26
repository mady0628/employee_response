const lark = require("@larksuiteoapi/node-sdk");

function getValidConfig() {
  const token = process.env.LARK_VERIFICATION_TOKEN;
  const encryptKey = process.env.LARK_ENCRYPT_KEY;

  if (!token || token === "your_verification_token") {
    throw new Error("LARK_VERIFICATION_TOKEN must be configured");
  }
  const verificationToken = token;
  const validEncryptKey =
    encryptKey && encryptKey !== "your_encrypt_key" ? encryptKey : undefined;

  return { verificationToken, encryptKey: validEncryptKey };
}

const config = getValidConfig();

const eventDispatcher = new lark.EventDispatcher({
  verificationToken: config.verificationToken,
  encryptKey: config.encryptKey
}).register({
  "im.message.receive_v1": async data => {
    return { code: 0 };
  },
  "im.message.reaction.created_v1": async data => {
    return { code: 0 };
  },
  "im.message.reaction.deleted_v1": async data => {
    return { code: 0 };
  }
});

const sdkHandler = lark.adaptExpress(eventDispatcher, { autoChallenge: true });

async function handleLarkWebhook(req, res, next) {
  try {
    return sdkHandler(req, res, next);
  } catch (error) {
    console.error("Lark webhook error:", error.message);
    return res.status(500).json({ code: -1, msg: error.message });
  }
}

module.exports = {
  handleLarkWebhook,
  eventDispatcher
};
