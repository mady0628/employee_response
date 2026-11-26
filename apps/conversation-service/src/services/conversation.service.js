const identityClient = require("../clients/identity.client");
const repository = require(
  "../repositories/conversation.repository"
);

async function processTelegramMessage(event) {
  if (!(await repository.isReadingEnabled(event))) {
    return {
      ignored: true,
      reason: "CONVERSATION_READING_DISABLED",
      senderType: "IGNORED"
    };
  }

  let senderType = "UNKNOWN";
  let employeeId = null;

  if (event.sender.isBot) {
    senderType = "BOT";
    console.log("Telegram bot message classified:", {
      platform: event.platform,
      platformUserId: event.sender.externalId,
      senderType
    });
  } else {
    const employee = await identityClient.resolveEmployee(
      event.platform,
      event.sender.externalId
    );

    if (employee) {
      senderType = "EMPLOYEE";
      employeeId = employee.id;
      console.log("Telegram sender recognized:", {
        platform: event.platform,
        platformUserId: event.sender.externalId,
        senderType,
        employeeId
      });
    } else {
      // Quy tắc MVP: user chưa xác thực là Customer.
      senderType = "CUSTOMER";
      console.warn("Telegram sender not matched to an active employee:", {
        platform: event.platform,
        platformUserId: event.sender.externalId,
        senderType,
        reason: "NO_VERIFIED_ACTIVE_EMPLOYEE_ACCOUNT"
      });
    }
  }

  return repository.saveMessage(
    event,
    senderType,
    employeeId
  ).then(result => ({ ...result, senderType }));
}

module.exports = { processTelegramMessage };
