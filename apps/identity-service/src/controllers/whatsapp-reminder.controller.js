const {
  getVerifiedWhatsAppEmployees
} = require("../repositories/whatsapp-reminder.repository");

async function listVerifiedWhatsApp(req, res) {
  try {
    const data = await getVerifiedWhatsAppEmployees();

    res.json({ success: true, data });
  } catch (error) {
    console.error("listVerifiedWhatsApp error:", error.message);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}

module.exports = {
  listVerifiedWhatsApp
};
