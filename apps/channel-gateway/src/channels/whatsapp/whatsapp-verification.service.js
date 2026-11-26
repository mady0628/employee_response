async function handleWhatsAppVerification(client, message) {
  // Không xử lý tin từ chính số giám sát.
  if (message.fromMe) return;

  // Chỉ xử lý chat riêng, không nhận lệnh group.
  const chat = await message.getChat();
  if (chat.isGroup) return;

  if (message.type !== "chat") return;

  const senderId = message.from;
  const text = String(message.body || "").trim();

  if (!text.startsWith("/verify")) {
    return;
  }

  const match = text.match(/^\/verify\s+([a-fA-F0-9]{32})$/);
  if (!match) {
    await client.sendMessage(
      senderId,
      "Sai cú pháp. Vui lòng nhập /verify <mã xác thực>."
    );
    return;
  }

  const code = match[1];

  try {
    const response = await fetch(
      `${process.env.IDENTITY_SERVICE_URL}/api/verifications/whatsapp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": process.env.IDENTITY_INTERNAL_API_KEY
        },
        body: JSON.stringify({
          code,
          whatsappUserId: senderId
        }),
        signal: AbortSignal.timeout(5000)
      }
    );

    if ([400, 403, 409].includes(response.status)) {
      await client.sendMessage(
        senderId,
        "Xác thực thất bại. Mã không hợp lệ, đã hết hạn, đã sử dụng hoặc tài khoản không được phép liên kết."
      );
      return;
    }

    if (!response.ok) {
      throw new Error(`Identity HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error("Invalid Identity response");
    }

    await client.sendMessage(
      senderId,
      [
        "✅ Xác thực thành công!",
        "Tài khoản WhatsApp đã được liên kết với Sales Reminder."
      ].join("\n")
    );
  } catch (error) {
    // Không log mã xác thực hoặc toàn bộ message.
    console.error(
      "WhatsApp verification service unavailable:",
      error.message
    );
    await client.sendMessage(
      senderId,
      "Hệ thống xác thực đang gặp sự cố. Vui lòng liên hệ quản trị viên để kiểm tra trạng thái xác thực."
    );
  }
}

module.exports = {
  handleWhatsAppVerification
};
