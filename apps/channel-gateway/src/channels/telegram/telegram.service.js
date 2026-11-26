const telegramClient = require("./telegram.client");
const identityClient = require("../../clients/identity.client");

async function handleStart(message, botToken) {
  await telegramClient.sendMessage(
    message.chat.id,
    [
      "Xin chào! Đây là Sales Reminder Bot.",
      "",
      "Để xác thực tài khoản nhân viên, gửi:",
      "/verify MA_XAC_THUC",
      "",
      "Bạn cần nhận mã từ quản trị viên."
    ].join("\n"),
    botToken
  );
}

async function handleVerify(message, code, botToken) {
  const chatId = message.chat.id;

  if (!code) {
    await telegramClient.sendMessage(
      chatId,
      "Vui lòng nhập: /verify MA_XAC_THUC",
      botToken
    );
    return;
  }

  try {
    const account = await identityClient.verifyTelegramAccount(
      code,
      {
        id: message.from.id,
        first_name: message.from.first_name,
        last_name: message.from.last_name,
        username: message.from.username
      }
    );

    // Identity đã commit thành công.
    // Việc gửi phản hồi Telegram là thao tác độc lập.
    try {
      await telegramClient.sendMessage(
        chatId,
        [
          "Xác thực thành công!",
          "",
          `Employee ID: ${account.employee_id}`,
          `Telegram ID: ${account.platform_user_id}`,
          "",
          "Bot đã nhận diện bạn là nhân viên Sales."
        ].join("\n"),
        botToken
      );
    } catch (sendError) {
      console.error(
        "Verification saved, but confirmation delivery failed:",
        sendError.message
      );
    }

  } catch (error) {
    if (error.status === 400 || error.status === 409) {
      await telegramClient.sendMessage(
        chatId,
        error.status === 409
          ? "Tài khoản Telegram đã liên kết với nhân viên khác."
          : "Mã không hợp lệ, đã sử dụng hoặc hết hạn.",
        botToken
      );
      return;
    }

    // Lỗi hệ thống: không thông báo mã sai khi chưa chắc chắn.
    throw error;
  }
}

async function handleTelegramMessage(message, botToken) {
  if (!message?.from || !message?.chat) {
    return;
  }

  // Giai đoạn này chỉ xử lý private chat.
  if (message.chat.type !== "private") {
    return;
  }

  if (message.from.is_bot) {
    return;
  }

  const text = message.text?.trim();
  if (!text) return;

  const parts = text.split(/\s+/);
  const command = parts[0].split("@")[0].toLowerCase();

  if (command === "/start") {
    await handleStart(message, botToken);
    return;
  }

  if (command === "/verify") {
    const code = parts.length === 2 ? parts[1] : null;
    await handleVerify(message, code, botToken);
    return;
  }
}

module.exports = { handleTelegramMessage };
