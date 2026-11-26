const verificationService = require("../services/verification.service");

async function generateCode(req, res, next) {
  try {
    const result = await verificationService.generateCode(
      req.body.employeeId
    );

    return res.status(201).json({
      success: true,
      message: "Verification code created",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function verifyTelegram(req, res, next) {
  try {
    const { code, telegramUser } = req.body;

    const account = await verificationService.verifyTelegram(
      code,
      telegramUser
    );

    return res.status(200).json({
      success: true,
      message: "Telegram account verified",
      data: account
    });
  } catch (error) {
    next(error);
  }
}

async function getVerifiedEmployees(req, res, next) {
  try {
    const employees = await verificationService.getVerifiedEmployees();

    return res.status(200).json({
      success: true,
      data: employees
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateCode,
  verifyTelegram,
  getVerifiedEmployees
};
