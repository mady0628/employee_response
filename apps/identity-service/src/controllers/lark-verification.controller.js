const {
  verifyLarkEmployee
} = require("../services/lark-verification.service");

async function verify(req, res) {
  try {
    const { code, larkOpenId, fullName, email } = req.body;

    const employee = await verifyLarkEmployee(
      code,
      larkOpenId,
      { fullName, email }
    );

    return res.json({
      success: true,
      message: "Lark account verified",
      data: employee
    });
  } catch (error) {
    console.error(
      "Lark verification failed:",
      error.status || 500,
      error.message
    );

    return res.status(error.status || 500).json({
      success: false,
      message: error.status
        ? error.message
        : "Internal server error"
    });
  }
}

module.exports = { verify };
