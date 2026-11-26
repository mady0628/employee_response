const {
  verifyWhatsAppEmployee
} = require("../services/whatsapp-verification.service");

async function verify(req, res) {
  try {
    const { code, whatsappUserId } = req.body;

    const data = await verifyWhatsAppEmployee(
      code,
      whatsappUserId
    );

    return res.json({
      success: true,
      message: "WhatsApp employee verified",
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.status
        ? error.message
        : "Internal server error"
    });
  }
}

module.exports = { verify };
