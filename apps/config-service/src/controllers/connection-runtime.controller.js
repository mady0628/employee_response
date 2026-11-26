const repository = require(
  "../repositories/connection-runtime.repository"
);

async function claim(req, res, next) {
  try {
    const connectionId = req.params.id;

    if (!/^[1-9]\d*$/.test(connectionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid connection ID"
      });
    }

    const data = await repository.claimRuntime({
      connectionId,
      generation: req.body.generation,
      runtimeInstanceId: req.body.runtimeInstanceId
    });

    if (!data) {
      return res.status(409).json({
        success: false,
        message: "Cannot claim runtime: connection mismatch or not in RUNNING state"
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const connectionId = req.params.id;

    if (!/^[1-9]\d*$/.test(connectionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid connection ID"
      });
    }

    const data = await repository.updateRuntime({
      connectionId,
      generation: req.body.generation,
      status: req.body.status,
      accountId: req.body.accountId ?? null,
      errorMessage: req.body.errorMessage ?? null,
      runtimeInstanceId: req.body.runtimeInstanceId ?? null
    });

    if (!data) {
      return res.status(409).json({
        success: false,
        message: "Connection, session generation or runtime instance mismatch"
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function heartbeat(req, res, next) {
  try {
    const connectionId = req.params.id;
    const { generation, runtimeInstanceId } = req.body || {};
    if (!/^[1-9]\d*$/.test(connectionId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runtimeInstanceId || "")) {
      return res.status(400).json({ success: false, message: "Invalid runtime heartbeat" });
    }
    const data = await repository.heartbeatRuntime({ connectionId, generation, runtimeInstanceId });
    if (!data) {
      return res.status(409).json({ success: false, message: "Runtime heartbeat rejected: owner or lifecycle mismatch" });
    }
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { claim, update, heartbeat };
