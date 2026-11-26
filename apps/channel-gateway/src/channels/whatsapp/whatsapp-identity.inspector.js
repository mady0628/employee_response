function getIdType(id) {
  if (id.endsWith("@lid")) {
    return "LID";
  }

  if (id.endsWith("@c.us")) {
    return "PHONE_JID";
  }

  return "OTHER";
}

async function inspectWhatsAppIdentity(
  client,
  platformUserId
) {
  const type = getIdType(platformUserId);

  const result = {
    sourceId: platformUserId,
    sourceType: type,
    lid: null,
    phoneJid: null,
    matched: false
  };

  try {
    const mappings = await client.getContactLidAndPhone(
      [platformUserId]
    );

    const mapping = mappings?.[0];

    if (!mapping) {
      return result;
    }

    const lid = mapping.lid;
    const phoneJid = mapping.pn;

    if (
      typeof lid === "string" &&
      lid.endsWith("@lid") &&
      typeof phoneJid === "string" &&
      phoneJid.endsWith("@c.us")
    ) {
      return {
        ...result,
        lid,
        phoneJid,
        matched: true
      };
    }

    return result;
  } catch (error) {
    console.error(
      "WhatsApp identity inspection unavailable:",
      error.message
    );

    return result;
  }
}

module.exports = {
  getIdType,
  inspectWhatsAppIdentity
};
