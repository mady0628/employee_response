const repository = require("../repositories/admin-connection.repository");

async function getConnections() {
  return repository.findAllConnections();
}

async function getConnectionById(id) {
  if (!/^[1-9]\d*$/.test(String(id))) {
    const error = new Error("Invalid connection ID");
    error.status = 400;
    throw error;
  }

  const connection = await repository.findConnectionById(id);
  if (!connection) {
    const error = new Error("Connection not found");
    error.status = 404;
    throw error;
  }

  return connection;
}

async function createWhatsApp({ displayName }) {
  if (
    typeof displayName !== "string" ||
    displayName.trim().length < 3 ||
    displayName.trim().length > 150
  ) {
    const error = new Error(
      "Tên kết nối phải có từ 3 đến 150 ký tự"
    );

    error.status = 400;
    throw error;
  }

  return repository.createWhatsAppConnection(
    displayName.trim()
  );
}

async function setDesiredState(id, desiredState) {
  if (!/^[1-9]\d*$/.test(String(id))) {
    const error = new Error("Invalid connection ID");
    error.status = 400;
    throw error;
  }

  if (!["RUNNING", "STOPPED"].includes(desiredState)) {
    const error = new Error("Invalid desired state");
    error.status = 400;
    throw error;
  }

  const updated = await repository.setDesiredState(id, desiredState);
  if (!updated) {
    const error = new Error("Connection not found or not WhatsApp");
    error.status = 404;
    throw error;
  }

  return updated;
}

async function getRunnableWhatsAppConnections() {
  return repository.findRunnableWhatsAppConnections();
}

async function toggleConnectionEnabled(id, isEnabled) {
  if (!/^[1-9]\d*$/.test(String(id))) {
    const error = new Error("Invalid connection ID");
    error.status = 400;
    throw error;
  }
  if (typeof isEnabled !== "boolean") {
    const error = new Error("isEnabled must be a boolean");
    error.status = 400;
    throw error;
  }
  const updated = await repository.setDesiredState(id, isEnabled ? "RUNNING" : "STOPPED");
  if (!updated) {
    const error = new Error("Connection not found");
    error.status = 404;
    throw error;
  }
  return updated;
}

module.exports = {
  getConnections,
  getConnectionById,
  createWhatsApp,
  createWhatsAppConnection: createWhatsApp,
  setDesiredState,
  getRunnableWhatsAppConnections,
  toggleConnectionEnabled
};
