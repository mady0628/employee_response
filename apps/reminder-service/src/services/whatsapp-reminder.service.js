const repository = require(
  "../repositories/reminder.repository"
);

const whatsappClient = require(
  "../clients/whatsapp.client"
);

const {
  getVerifiedWhatsAppEmployees
} = require(
  "../clients/whatsapp-identity.client"
);
const { deferIfOutsideSupportHours } = require("./reminder-hours");
const { supportMinutesBetween } = require("../../../../shared/support-hours");

function createReminderText(context) {
  const waitingMinutes = Math.max(0, Math.floor(supportMinutesBetween(context.waiting_started_at, new Date()) || 0));

  const customerName =
    context.sender_display_name?.trim() ||
    (context.sender_username
      ? `@${context.sender_username}`
      : context.customer_platform_id
        ? context.customer_platform_id.endsWith("@lid")
          ? "Khách WhatsApp (chưa có tên hiển thị)"
          : `WhatsApp ${context.customer_platform_id.replace(/@c\.us$/, "")}`
        : "Chưa nhận diện được tên khách");
  const messageContent = context.customer_message_content?.trim() ||
    `[Tin nhắn ${context.customer_message_type || "WhatsApp"} không có nội dung văn bản]`;
  const messagePreview = messageContent.length > 1400
    ? `${messageContent.slice(0, 1400)}…`
    : messageContent;

  const text = [
    "🔔 NHẮC NHỞ PHẢN HỒI KHÁCH HÀNG",
    "",
    `Group: ${context.group_title || context.external_chat_id}`,
    `Khách hàng: ${customerName}`,
    `Nội dung khách gửi: ${messagePreview}`,
    `Khách đã chờ trong giờ hỗ trợ: ${waitingMinutes} phút`,
    `Lần nhắc: ${context.reminder_number}`,
    "",
    "Khách hàng vẫn chưa được phản hồi.",
    "Vui lòng kiểm tra group để hỗ trợ khách."
  ].join("\n");

  return text.length > 1950
    ? `${text.slice(0, 1949)}…`
    : text;
}

function findEmployeeGroupId(employee, groupMembers) {
  const employeeIds = new Set(employee.platformUserIds);
  const matches = groupMembers.filter(member =>
    member.identityIds.some(id => employeeIds.has(id))
  );

  // Một seller chỉ được nhắc khi đúng một member trong group
  // khớp danh tính đã xác minh. Dùng ID gốc của member để gửi DM.
  return matches.length === 1
    ? matches[0].recipientId
    : null;
}

async function processWhatsAppReminderJob(job, context) {
  const employees =
    await getVerifiedWhatsAppEmployees();

  const membersResult =
    await whatsappClient.getGroupMembers(
      context.channel_connection_id,
      context.external_chat_id
    );

  if (
    !Array.isArray(membersResult.memberIds) ||
    !Array.isArray(membersResult.members)
  ) {
    throw new Error("Group member list unavailable");
  }

  const groupMembers = membersResult.members;

  const text = createReminderText(context);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const employee of employees) {
    if (await deferIfOutsideSupportHours(repository, job.id)) {
      return { action: "DEFERRED", reason: "OUTSIDE_SUPPORT_HOURS", sent, skipped, failed };
    }
    const recipientId = findEmployeeGroupId(
      employee,
      groupMembers
    );

    const previous = await repository.getDelivery(
      job.id,
      employee.employeeId
    );

    if (previous?.status === "SENT") {
      continue;
    }

    if (!recipientId) {
      // Không biết chắc Sales ở trong group
      // hoặc có nhiều ID khớp: cần rà soát.
      await repository.saveWhatsAppDelivery({
        jobId: job.id,
        employeeId: employee.employeeId,
        platformUserId:
          employee.platformUserIds[0],
        status: "SKIPPED",
        errorMessage: "Membership or ID ambiguous"
      });

      skipped++;
      continue;
    }

    if (!(await repository.isSlaWaiting(context.sla_id))) {
      await repository.cancelJob(job.id);

      return {
        action: "CANCELLED",
        sent,
        skipped,
        failed
      };
    }

    if (await deferIfOutsideSupportHours(repository, job.id)) {
      return { action: "DEFERRED", reason: "OUTSIDE_SUPPORT_HOURS", sent, skipped, failed };
    }

    try {
      const result = await whatsappClient.sendReminder(
        context.channel_connection_id,
        context.external_chat_id,
        recipientId,
        text
      );

      await repository.saveWhatsAppDelivery({
        jobId: job.id,
        employeeId: employee.employeeId,
        platformUserId: recipientId,
        status: "SENT",
        externalMessageId: result.messageId
      });

      sent++;
    } catch (error) {
      await repository.saveWhatsAppDelivery({
        jobId: job.id,
        employeeId: employee.employeeId,
        platformUserId: recipientId,
        status: "FAILED",
        errorMessage:
          "WhatsApp reminder delivery failed"
      });

      failed++;
    }
  }

  if (failed > 0) {
    await repository.failJob(
      job.id,
      `${failed} WhatsApp deliveries failed`
    );

    return {
      action: "RETRY_OR_FAILED",
      sent,
      skipped,
      failed
    };
  }

  await repository.completeJob(job.id);

  return {
    action: "COMPLETED",
    sent,
    skipped,
    failed
  };
}

module.exports = {
  findEmployeeGroupId,
  processWhatsAppReminderJob
};
