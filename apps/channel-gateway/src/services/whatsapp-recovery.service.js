const { manager } = require("./whatsapp-session.service");
const {
  getRunnableWhatsAppConnections
} = require("../clients/config.client");

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

async function restoreWhatsAppSessions() {
  try {
    const connections = await getRunnableWhatsAppConnections();

    if (!Array.isArray(connections) || connections.length === 0) {
      console.log("[WhatsApp Recovery] Không có phiên WhatsApp nào ở trạng thái RUNNING cần khôi phục.");
      return;
    }

    console.log(
      `[WhatsApp Recovery] Restoring ${connections.length} WhatsApp sessions...`
    );

    for (const connection of connections) {
      let started = false;
      for (let attempt = 0; attempt < 13 && !started; attempt += 1) {
        try {
          await manager.start(
            connection.id,
            connection.session_generation || 1
          );
          console.log(
            `[WhatsApp Recovery] WhatsApp starting #${connection.id} (${connection.display_name})`
          );
          started = true;
        } catch (error) {
          if (attempt === 12) {
            console.error(
              `[WhatsApp Recovery] WhatsApp restore failed on #${connection.id}:`,
              error.message
            );
          } else {
            console.warn(
              `[WhatsApp Recovery] Retry ${attempt + 1}/12 for #${connection.id}:`,
              error.message
            );
            await sleep(10000);
          }
        }
      }

      // Giãn thời điểm mở Chromium để tránh nghẽn CPU/RAM
      if (started) await sleep(3000);
    }
  } catch (error) {
    console.error("[WhatsApp Recovery] restoreWhatsAppSessions error:", error.message);
  }
}

module.exports = {
  restoreWhatsAppSessions
};
