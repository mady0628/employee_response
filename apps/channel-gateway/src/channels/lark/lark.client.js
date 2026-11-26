const Lark = require("@larksuiteoapi/node-sdk");

const client = new Lark.Client({
  appId: process.env.LARK_APP_ID,
  appSecret: process.env.LARK_APP_SECRET,
  domain: Lark.Domain.Lark
});

async function sendPrivateMessage(openId, text) {
  const result = await client.im.message.create({
    params: {
      receive_id_type: "open_id"
    },
    data: {
      receive_id: openId,
      msg_type: "text",
      content: JSON.stringify({
        text
      })
    }
  });

  if (result.code !== 0) {
    throw new Error(
      `Lark send message failed: ${result.code}`
    );
  }

  return result.data;
}

async function getUserProfile(openId) {
  const result = await client.contact.user.get({
    path: { user_id: String(openId) },
    params: { user_id_type: "open_id" }
  });

  if (result.code !== 0 || !result.data?.user) {
    throw new Error(`Lark user profile lookup failed: ${result.code}`);
  }

  return result.data.user;
}

async function listGroupMemberIds(chatId) {
  const members = new Set();
  let pageToken;

  do {
    const response = await client.im.chatMembers.get({
      path: {
        chat_id: chatId
      },
      params: {
        member_id_type: "open_id",
        page_size: 100,
        ...(pageToken
          ? { page_token: pageToken }
          : {})
      }
    });

    if (
      response.code !== 0 ||
      !response.data ||
      !Array.isArray(response.data.items)
    ) {
      throw new Error(
        `Cannot list Lark group members: ${response.code}`
      );
    }

    for (const member of response.data.items) {
      if (member.member_id) {
        members.add(String(member.member_id));
      }
    }

    if (
      response.data.has_more &&
      !response.data.page_token
    ) {
      throw new Error(
        "Lark pagination token is missing"
      );
    }

    pageToken = response.data.has_more
      ? response.data.page_token
      : null;
  } while (pageToken);

  return [...members];
}

module.exports = {
  sendPrivateMessage,
  getUserProfile,
  listGroupMemberIds
};
