const service = require("../services/channel.service");

async function createChannel(req, res, next) {
  try {
    const channel = await service.createChannel(req.body);
    return res.status(201).json({ success: true, data: channel });
  } catch (error) {
    next(error);
  }
}

async function getChannels(req, res, next) {
  try {
    const channels = await service.getChannels(
      req.query.platform
    );
    return res.json({ success: true, data: channels });
  } catch (error) {
    next(error);
  }
}

async function getChannelById(req, res, next) {
  try {
    const channel = await service.getChannelById(
      req.params.id
    );
    return res.json({ success: true, data: channel });
  } catch (error) {
    next(error);
  }
}

module.exports = { createChannel, getChannels, getChannelById };
