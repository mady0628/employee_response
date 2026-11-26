const service = require("../services/telegram-bot.service");

async function list(req, res, next) {
  try {
    return res.json({ success: true, data: await service.list() });
  } catch (error) { return next(error); }
}

async function create(req, res, next) {
  try {
    const bot = await service.create(req.body || {});
    return res.status(201).json({ success: true, data: bot });
  } catch (error) { return next(error); }
}

async function runtimeCredentials(req, res, next) {
  try {
    return res.json({ success: true, data: await service.getRuntimeCredentials(req.params.id) });
  } catch (error) { return next(error); }
}

async function setStatus(req, res, next) {
  try {
    const { status, errorMessage } = req.body || {};
    return res.json({ success: true, data: await service.setStatus(req.params.id, status, errorMessage) });
  } catch (error) { return next(error); }
}

module.exports = { list, create, runtimeCredentials, setStatus };
