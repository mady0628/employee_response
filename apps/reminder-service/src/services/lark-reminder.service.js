const repository = require(
  "../repositories/reminder.repository"
);

const {
  getVerifiedLarkEmployees
} = require("../clients/lark-identity.client");

const larkClient = require(
  "../clients/lark.client"
);
const { deferIfOutsideSupportHours } = require("./reminder-hours");
const { supportMinutesBetween } = require("../../../../shared/support-hours");

function buildLarkReminder(context) {
  const minutes = Math.max(0, Math.floor(supportMinutesBetween(context.waiting_started_at, new Date()) || 0));

  return [
    "🔔 NHẮC NHỞ PHẢN HỒI KHÁCH HÀNG",
    "",
    `Group: ${context.group_title || context.external_chat_id}`,
    `Khách hàng: ${context.customer_platform_id}`,
    `Đã chờ trong giờ hỗ trợ: ${minutes} phút`,
    `Lần nhắc: ${context.reminder_number}`,
    "",
    "Khách hàng vẫn chưa được phản hồi.",
    "Vui lòng vào group để hỗ trợ khách."
  ].join("\n");
}

async function processLarkReminderJob(job, context) {
  // 1. Lấy Sales đang ACTIVE và đã xác thực Lark.
  const employees = await getVerifiedLarkEmployees();

  // 2. Lấy toàn bộ thành viên group, có phân trang.
  // Nếu API lỗi, throw để retry job; không kết luận nhầm rằng group không có Sales.
  const result = await larkClient.getGroupMembers(
    context.channel_connection_id,
    context.external_chat_id
  );

  const groupMembers = new Set(result.memberIds);

  const text = buildLarkReminder(context);

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const employee of employees) {
    if (await deferIfOutsideSupportHours(repository, job.id)) {
      return { action: "DEFERRED", reason: "OUTSIDE_SUPPORT_HOURS", sentCount };
    }
    const employeeId = employee.employeeId;
    const openId = employee.larkOpenId;

    // Đã gửi thành công thì không gửi lại.
    const previous = await repository.getDelivery(
      job.id,
      employeeId
    );

    if (previous?.status === "SENT") {
      continue;
    }

    // 3. Chỉ nhắc nhân viên có trong group.
    if (!groupMembers.has(openId)) {
      await repository.saveLarkDelivery({
        jobId: job.id,
        employeeId,
        openId,
        status: "SKIPPED",
        errorMessage: "Employee not in Lark group"
      });

      skippedCount++;
      continue;
    }

    // 4. Kiểm tra SLA vẫn còn WAITING.
    if (!(await repository.isSlaWaiting(context.sla_id))) {
      await repository.cancelJob(job.id);

      return {
        action: "CANCELLED",
        reason: "SLA_ALREADY_CLOSED",
        sentCount
      };
    }

    if (await deferIfOutsideSupportHours(repository, job.id)) {
      return { action: "DEFERRED", reason: "OUTSIDE_SUPPORT_HOURS", sentCount };
    }

    // 5. Gửi DM đến Sales.
    try {
      await larkClient.sendPrivateMessage(
        context.channel_connection_id,
        openId,
        text
      );

      await repository.saveLarkDelivery({
        jobId: job.id,
        employeeId,
        openId,
        status: "SENT"
      });

      sentCount++;
    } catch (error) {
      await repository.saveLarkDelivery({
        jobId: job.id,
        employeeId,
        openId,
        status: "FAILED",
        errorMessage:
          "Lark private message delivery failed"
      });

      failedCount++;
    }
  }

  if (failedCount > 0) {
    await repository.failJob(
      job.id,
      `${failedCount} Lark deliveries failed`
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

module.exports = {
  processLarkReminderJob,
  buildLarkReminder
};
