const pool = require("../config/database");
const repository = require("../repositories/whatsapp-conversation.repository");

async function resolveEmployee(platformUserId) {
  try {
    const query = new URLSearchParams({
      platform: "WHATSAPP",
      platformUserId
    });
    const response = await fetch(
      `${process.env.IDENTITY_SERVICE_URL}/api/employees/resolve?${query}`,
      {
        headers: {
          "x-internal-api-key": process.env.IDENTITY_INTERNAL_API_KEY
        },
        signal: AbortSignal.timeout(2000)
      }
    );
    if (!response.ok) {
      throw new Error(
        `Identity Service returned HTTP ${response.status}`
      );
    }

    const result = await response.json();
    if (result.success !== true) {
      throw new Error("Invalid Identity Service response");
    }

    return result.data || null;
  } catch (err) {
    // Identity service offline -> Fallback truy vấn trực tiếp bảng employee_channel_accounts & aliases
    try {
      const dbRes = await pool.query(
        `SELECT e.id, e.full_name, e.status
         FROM employees e
         WHERE e.status = 'ACTIVE'
           AND (
             EXISTS (
               SELECT 1 FROM employee_channel_accounts a
               WHERE a.employee_id = e.id
                 AND a.platform = 'WHATSAPP'
                 AND a.platform_user_id = $1
                 AND a.status = 'VERIFIED'
             )
             OR EXISTS (
               SELECT 1 FROM whatsapp_identity_aliases a
               WHERE a.employee_id = e.id
                 AND a.platform_user_id = $1
                 AND a.status = 'VERIFIED'
             )
           )
         LIMIT 2`,
        [platformUserId]
      );
      if (dbRes.rowCount) {
        return dbRes.rows[0];
      }
    } catch (dbErr) {
      console.warn("DB fallback resolve employee failed:", dbErr.message);
      throw dbErr;
    }
  }
  return null;
}

async function processWhatsAppMessage(event) {
  if (
    event?.platform !== "WHATSAPP" ||
    event.eventType !== "channel.message.received" ||
    event.conversation?.type !== "GROUP" ||
    !event.sender?.externalId ||
    !event.message?.externalId
  ) {
    const error = new Error("Invalid WhatsApp event");
    error.code = "INVALID_EVENT";
    throw error;
  }

  // Tài khoản giám sát không được tự tạo SLA.
  if (event.sender.isBot === true || event.sender.isMonitor === true) {
    return { ignored: true };
  }

  let employee = null;
  try {
    employee = await resolveEmployee(event.sender.externalId);
  } catch (err) {
    // Không ném lỗi nếu identity service chưa có hoặc mạng lỗi
    console.warn("Resolve employee lookup returned error:", err.message);
  }

  // Nhân viên đã xác minh được nhận diện từ Identity Service.
  // Người gửi khác (ngoại trừ tài khoản monitor/bot đã lọc phía trên) là khách.
  const senderType = employee ? "EMPLOYEE" : "CUSTOMER";
  const result = await repository.saveWhatsAppMessage({
    event,
    senderType,
    employeeId: employee?.id || null
  });
  return result;
}

module.exports = { processWhatsAppMessage };
