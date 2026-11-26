require("dotenv").config();

const {
  client,
  startWhatsApp
} = require("./whatsapp.client");

const {
  inspectWhatsAppIdentity
} = require("./whatsapp-identity.inspector");

const targetId = process.env.WA_INSPECT_USER_ID;

if (!targetId) {
  throw new Error("WA_INSPECT_USER_ID is missing");
}

client.on("ready", async () => {
  try {
    const result = await inspectWhatsAppIdentity(
      client,
      targetId
    );

    console.log(
      JSON.stringify(result, null, 2)
    );
  } catch (error) {
    console.error(error);
  } finally {
    await client.destroy();
    process.exit(0);
  }
});

startWhatsApp().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
