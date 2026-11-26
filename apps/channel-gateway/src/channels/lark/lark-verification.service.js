const larkClient = require("./lark.client");

async function handlePrivateMessage(data) {
  const { sender, message } = data;

  if (message?.chat_type !== "p2p") {
    return;
  }

  if (sender?.sender_type !== "user") {
    return;
  }

  const openId = sender.sender_id?.open_id;

  if (!openId) {
    return;
  }

  if (message.message_type !== "text") {
    return;
  }

  let content;

  try {
    content = JSON.parse(message.content);
  } catch {
    return;
  }

  const text = String(content.text || "").trim();

  if (text === "/start") {
    await larkClient.sendPrivateMessage(
      openId,
      "Xin chào! Hãy nhập /verify <mã xác thực> để liên kết tài khoản Sales."
    );
    return;
  }

  if (!text.startsWith("/verify")) {
    return;
  }

  const match = text.match(/^\/verify\s+([^\s]+)$/);

  if (!match) {
    await larkClient.sendPrivateMessage(
      openId,
      "Cú pháp: /verify <mã xác thực>"
    );
    return;
  }

  const code = match[1];
  let profile = {};
  try {
    profile = await larkClient.getUserProfile(openId);
    console.log("Lark profile lookup succeeded:", {
      fields: Object.keys(profile),
      hasName: Boolean(profile.name?.trim()),
      hasEnglishName: Boolean(profile.en_name?.trim()),
      hasEmail: Boolean(profile.email || profile.enterprise_email)
    });
  } catch (error) {
    console.error("Lark profile lookup failed:", error.message);
  }
  const fullName = String(profile.name || profile.en_name || "").trim();

  const response = await fetch(
    `${process.env.IDENTITY_SERVICE_URL}/api/verifications/lark`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key":
          process.env.IDENTITY_INTERNAL_API_KEY
      },
      body: JSON.stringify({
        code,
        larkOpenId: openId,
        ...(fullName ? { fullName } : {}),
        ...(
          profile.email || profile.enterprise_email
            ? { email: profile.email || profile.enterprise_email }
            : {}
        )
      }),
      signal: AbortSignal.timeout(5000)
    }
  );

  if (!response.ok) {
    if ([400, 403, 409].includes(response.status)) {
      let errorResult = {};
      try {
        errorResult = await response.json();
      } catch {
        // Keep the generic verification response for malformed bodies.
      }

      const failureMessage =
        errorResult.message === "Lark profile name is required for onboarding"
          ? "Không lấy được hồ sơ Lark để tạo nhân viên. Hãy cấp quyền đọc danh bạ cho ứng dụng rồi thử lại."
          : "Xác thực thất bại. Mã không hợp lệ, hết hạn, đã sử dụng hoặc tài khoản không được phép liên kết.";

      await larkClient.sendPrivateMessage(
        openId,
        failureMessage
      );
      return;
    }

    throw new Error(
      `Identity Service error: ${response.status}`
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error("Invalid Identity response");
  }

  await larkClient.sendPrivateMessage(
    openId,
    "✅ Xác thực thành công!\nTài khoản Lark đã được liên kết với hệ thống Sales Reminder."
  );
}

module.exports = {
  handlePrivateMessage
};
