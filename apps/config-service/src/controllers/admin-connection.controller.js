const service = require("../services/admin-connection.service");

async function getAll(req, res, next) {
  try {
    const connections = await service.getConnections();
    return res.json({ success: true, data: connections });
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const connection = await service.getConnectionById(req.params.id);
    return res.json({ success: true, data: connection });
  } catch (error) {
    next(error);
  }
}

async function createWhatsApp(req, res, next) {
  try {
    const { displayName } = req.body || {};
    const connection = await service.createWhatsAppConnection({ displayName });
    return res.status(201).json({ success: true, data: connection });
  } catch (error) {
    next(error);
  }
}

async function toggleEnabled(req, res, next) {
  try {
    const { isEnabled } = req.body || {};
    const connection = await service.toggleConnectionEnabled(
      req.params.id,
      isEnabled
    );
    return res.json({ success: true, data: connection });
  } catch (error) {
    next(error);
  }
}

async function setDesiredState(req, res, next) {
  try {
    const { desiredState } = req.body || {};
    const connection = await service.setDesiredState(
      req.params.id,
      desiredState
    );
    return res.json({ success: true, data: connection });
  } catch (error) {
    next(error);
  }
}

async function getRunnableWhatsApp(req, res, next) {
  try {
    const connections = await service.getRunnableWhatsAppConnections();
    return res.json({ success: true, data: connections });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAll,
  getOne,
  createWhatsApp,
  setDesiredState,
  getRunnableWhatsApp,
  toggleEnabled
};
