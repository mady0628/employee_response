const monitoredGroupRepository = require("../repositories/monitored-group.repository");

async function discoverGroup(req, res, next) {
  try {
    const { channelConnectionId, externalGroupId, groupName } = req.body;

    if (!channelConnectionId || !externalGroupId) {
      return res.status(400).json({
        success: false,
        message: "channelConnectionId and externalGroupId are required"
      });
    }

    const autoActivate = process.env.WA_AUTO_ACTIVATE_GROUPS === "true";

    const group = await monitoredGroupRepository.discoverGroup({
      channelConnectionId: Number(channelConnectionId),
      externalGroupId,
      groupName: groupName || null,
      autoActivate
    });

    return res.status(200).json({
      success: true,
      group
    });
  } catch (error) {
    next(error);
  }
}

async function getGroup(req, res, next) {
  try {
    const { connectionId, groupId } = req.params;

    const group = await monitoredGroupRepository.getGroup(
      Number(connectionId),
      groupId
    );

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Monitored group not found"
      });
    }

    return res.status(200).json({
      success: true,
      group
    });
  } catch (error) {
    next(error);
  }
}

async function listGroups(req, res, next) {
  try {
    const connectionId = req.query.channelConnectionId
      ? Number(req.query.channelConnectionId)
      : null;

    const groups = await monitoredGroupRepository.listMonitoredGroups(connectionId);

    return res.status(200).json({
      success: true,
      groups
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  discoverGroup,
  getGroup,
  listGroups
};
