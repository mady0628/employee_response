const path = require("node:path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "sales-reminder-monitor",
    dataPath: path.resolve(process.cwd(), ".wwebjs_auth")
  }),
  puppeteer: {
    headless: true
  }
});

let monitoringStartedAt = null;
let ready = false;

client.on("qr", qr => {
  console.warn("WhatsApp session needs pairing; QR output is disabled in logs. Set WA_LOG_QR=true only for a controlled local setup.");
  if (process.env.WA_LOG_QR === "true" && process.env.NODE_ENV !== "production") {
    qrcode.generate(qr, { small: true });
  }
});

client.on("authenticated", () => {
  console.log("WhatsApp authenticated");
});

client.on("auth_failure", message => {
  ready = false;
  monitoringStartedAt = null;
  console.error("WhatsApp auth failure:", message);
});

client.on("ready", () => {
  ready = true;
  // Bắt đầu giám sát từ khi client sẵn sàng.
  monitoringStartedAt = new Date();
  console.log("WhatsApp Client ready");
  console.log("Monitoring started at:", monitoringStartedAt.toISOString());
});

client.on("disconnected", reason => {
  ready = false;
  monitoringStartedAt = null;
  console.error("WhatsApp disconnected:", reason);
});

function isMonitoringReady() {
  return ready;
}

function getMonitoringStartedAt() {
  return monitoringStartedAt;
}

async function startWhatsApp() {
  await client.initialize();
}

module.exports = {
  client,
  startWhatsApp,
  isMonitoringReady,
  getMonitoringStartedAt
};
