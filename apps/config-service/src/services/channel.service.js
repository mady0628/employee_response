const repository = require("../repositories/channel.repository");

const PLATFORMS = [
  "TELEGRAM",
  "WHATSAPP",
  "ZALO",
  "LARK",
  "MESSENGER"
];

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateId(value) {
  const id = String(value ?? "");

  if (
    !/^[1-9]\d*$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw createError(400, "Invalid channel ID");
  }

  return id;
}

async function createChannel(data) {
  if (!data || typeof data !== "object") {
    throw createError(400, "Invalid request body");
  }

  const platform = data.platform;

  if (!PLATFORMS.includes(platform)) {
    throw createError(400, "Invalid platform");
  }

  const externalAccountId = String(data.externalAccountId ?? "").trim();
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const accountUsername =
    data.accountUsername == null
      ? null
      : String(data.accountUsername).trim();
  const credentialReference =
    data.credentialReference == null
      ? null
      : String(data.credentialReference).trim();

  if (!externalAccountId || externalAccountId.length > 255) {
    throw createError(400, "Invalid externalAccountId");
  }

  if (!name || name.length > 150) {
    throw createError(400, "Invalid name");
  }

  if (accountUsername && accountUsername.length > 150) {
    throw createError(400, "Invalid accountUsername");
  }

  if (credentialReference && credentialReference.length > 150) {
    throw createError(400, "Invalid credentialReference");
  }

  return repository.createChannel({
    platform,
    externalAccountId,
    name,
    accountUsername,
    credentialReference
  });
}

async function getChannels(platform) {
  if (platform && !PLATFORMS.includes(platform)) {
    throw createError(400, "Invalid platform");
  }

  return repository.findAll(platform || null);
}

async function getChannelById(id) {
  const channel = await repository.findById(validateId(id));

  if (!channel) {
    throw createError(404, "Channel not found");
  }

  return channel;
}

module.exports = {
  createChannel,
  getChannels,
  getChannelById
};
