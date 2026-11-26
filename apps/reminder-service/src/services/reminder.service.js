const repository = require(
  "../repositories/reminder.repository"
);
const identityClient = require(
  "../clients/identity.client"
);
const gatewayClient = require(
  "../clients/gateway.client"
);
const {
  processLarkReminderJob
} = require("./lark-reminder.service");
const {
  processWhatsAppReminderJob
} = require("./whatsapp-reminder.service");
const { deferIfOutsideSupportHours } = require("./reminder-hours");
const { supportMinutesBetween } = require("../../../../shared/support-hours");

function isGroupMember(member) {
  if (["creator", "administrator", "member"].includes(member.status)) {
    return true;
  }

  return (
    member.status === "restricted" && member.isMember === true
  );
}

function buildReminderMessage(context) {
  const waitingMinutes = Math.floor(supportMinutesBetween(context.waiting_started_at, new Date()) || 0);

  const senderName = context.sender_display_name ||
    (context.sender_username ? `@${context.sender_username}` : null) ||
    `Telegram ID ${context.message_sender_platform_id || context.customer_platform_id}`;
  const senderUsername = context.sender_username && context.sender_display_name
    ? ` (@${context.sender_username})`
    : "";
  const messageContent = context.customer_message_content?.trim() ||
    `[${context.customer_message_type || "MESSAGE"} không có nội dung văn bản]`;
  const messagePreview = messageContent.length > 1800
    ? `${messageContent.slice(0, 1800)}…`
    : messageContent;

  return [
    "🔔 NHẮC NHỞ PHẢN HỒI KHÁCH HÀNG",
    "",
    `Group: ${context.group_title || context.external_chat_id}`,
    `Người gửi: ${senderName}${senderUsername}`,
    `Nội dung: ${messagePreview}`,
    `Khách đã chờ trong giờ hỗ trợ: ${waitingMinutes} phút`,
    `Lần nhắc: ${context.reminder_number}`,
    "",
    "Khách hàng vẫn chưa được phản hồi.",
    "Vui lòng vào group để hỗ trợ khách."
  ].join("\n");
}

async function processReminderJob(job) {
  if (await deferIfOutsideSupportHours(repository, job.id)) {
    return { action: "DEFERRED", reason: "OUTSIDE_SUPPORT_HOURS" };
  }
  const context = await repository.getJobContext(job.id);

  if (!context) {
    throw new Error("Reminder job context not found");
  }

  if (
    context.sla_status !== "WAITING" ||
    context.conversation_status !== "ACTIVE"
  ) {
    await repository.cancelJob(job.id);
    return {
      action: "CANCELLED",
      reason: "SLA_OR_CONVERSATION_INACTIVE"
    };
  }

  if (context.platform === "LARK") {
    return processLarkReminderJob(job, context);
  }

  if (context.platform === "WHATSAPP") {
    return processWhatsAppReminderJob(job, context);
  }

  if (context.platform !== "TELEGRAM") {
    throw new Error(
      `Unsupported reminder platform: ${context.platform}`
    );
  }

  const employees = await identityClient.getVerifiedEmployees();
  const messageText = buildReminderMessage(context);

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const employee of employees) {
    if (await deferIfOutsideSupportHours(repository, job.id)) {
      return { action: "DEFERRED", reason: "OUTSIDE_SUPPORT_HOURS", sentCount };
    }
    const previousDelivery = await repository.getDelivery(
      job.id,
      employee.employee_id
    );

    // Đã gửi thành công trong lần xử lý trước.
    if (previousDelivery?.status === "SENT") {
      continue;
    }

    // Kiểm tra lại SLA trước mỗi lần gửi.
    const stillWaiting = await repository.isSlaWaiting(
      context.sla_id
    );

    if (!stillWaiting) {
      await repository.cancelJob(job.id);
      return {
        action: "CANCELLED",
        reason: "SLA_ALREADY_RESPONDED",
        sentCount
      };
    }

    let member;

    try {
      member = await gatewayClient.getChatMember(
        context.channel_connection_id,
        context.external_chat_id,
        employee.telegram_user_id
      );
    } catch (error) {
      console.error("Reminder getChatMember failed:", {
        jobId: job.id,
        slaId: context.sla_id,
        employeeId: employee.employee_id,
        telegramUserId: employee.telegram_user_id,
        error: error.message
      });
      await repository.saveDelivery({
        jobId: job.id,
        employeeId: employee.employee_id,
        telegramUserId: employee.telegram_user_id,
        status: "FAILED",
        errorMessage: error.message
      });

      failedCount++;
      continue;
    }

    if (!isGroupMember(member)) {
      await repository.saveDelivery({
        jobId: job.id,
        employeeId: employee.employee_id,
        telegramUserId: employee.telegram_user_id,
        status: "SKIPPED",
        errorMessage: "Employee is not a group member"
      });

      skippedCount++;
      continue;
    }

    if (await deferIfOutsideSupportHours(repository, job.id)) {
      return { action: "DEFERRED", reason: "OUTSIDE_SUPPORT_HOURS", sentCount };
    }

    // Kiểm tra lại lần cuối ngay trước khi gửi.
    if (!(await repository.isSlaWaiting(context.sla_id))) {
      await repository.cancelJob(job.id);
      return {
        action: "CANCELLED",
        reason: "SLA_ALREADY_RESPONDED",
        sentCount
      };
    }

    try {
      await gatewayClient.sendMessage(
        context.channel_connection_id,
        employee.telegram_user_id,
        messageText
      );

      await repository.saveDelivery({
        jobId: job.id,
        employeeId: employee.employee_id,
        telegramUserId: employee.telegram_user_id,
        status: "SENT"
      });

      sentCount++;
    } catch (error) {
      console.error("Reminder Telegram send failed:", {
        jobId: job.id,
        slaId: context.sla_id,
        employeeId: employee.employee_id,
        telegramUserId: employee.telegram_user_id,
        error: error.message
      });
      await repository.saveDelivery({
        jobId: job.id,
        employeeId: employee.employee_id,
        telegramUserId: employee.telegram_user_id,
        status: "FAILED",
        errorMessage: error.message
      });

      failedCount++;
    }
  }

  if (failedCount > 0) {
    await repository.failJob(
      job.id,
      `${failedCount} employee deliveries failed`
    );

    return {
      action: "RETRY_OR_FAILED",
      sentCount,
      skippedCount,
      failedCount
    };
  }

  await repository.completeJob(job.id);

  return {
    action: "COMPLETED",
    sentCount,
    skippedCount,
    failedCount
  };
}

module.exports = { processReminderJob, isGroupMember, buildReminderMessage };
