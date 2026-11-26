const repository = require("../repositories/sla.repository");
const { buildResponseTimeReport } = require("../services/response-time-report.service");

function parseDays(value, fallback, max) {
  const days = Number(value ?? fallback);
  if (!Number.isInteger(days) || days < 1 || days > max) {
    const error = new Error(`days must be an integer from 1 to ${max}`);
    error.status = 400;
    throw error;
  }
  return days;
}

const vnDate = value => new Date(value.getTime() + 7 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

function shiftDate(value, days) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function parseDateOnly(value, name, fallback) {
  const result = value ?? fallback;
  const parsed = typeof result === "string" && /^\d{4}-\d{2}-\d{2}$/.test(result)
    ? new Date(`${result}T00:00:00.000Z`)
    : null;
  if (
    !parsed ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== result
  ) {
    const error = new Error(`${name} must be a valid date in YYYY-MM-DD format`);
    error.status = 400;
    throw error;
  }
  return result;
}

async function getOverview(req, res, next) {
  try {
    const days = parseDays(req.query.days, 7, 90);
    const [overview, policy] = await Promise.all([
      repository.getDashboardOverview(days),
      repository.getPolicy()
    ]);
    return res.json({ success: true, data: { ...overview, policy } });
  } catch (error) {
    return next(error);
  }
}

async function listSlas(req, res, next) {
  try {
    const status = String(req.query.status || "ALL").toUpperCase();
    const platform = String(req.query.platform || "ALL").toUpperCase();
    const limit = Number(req.query.limit || 100);
    if (!["ALL", "WAITING", "RESPONDED", "CANCELLED"].includes(status)) {
      const error = new Error("Invalid SLA status filter");
      error.status = 400;
      throw error;
    }
    if (!["ALL", "TELEGRAM", "LARK", "WHATSAPP"].includes(platform)) {
      const error = new Error("Invalid platform filter");
      error.status = 400;
      throw error;
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      const error = new Error("limit must be between 1 and 500");
      error.status = 400;
      throw error;
    }
    const rows = await repository.listAdminSlas({ status, platform, limit });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
}

async function getReport(req, res, next) {
  try {
    const days = parseDays(req.query.days, 14, 90);
    const [rows, policy] = await Promise.all([
      repository.getDailyReport(days),
      repository.getPolicy()
    ]);
    return res.json({ success: true, data: { rows, policy } });
  } catch (error) {
    return next(error);
  }
}

async function getResponseTimeReport(req, res, next) {
  try {
    const today = vnDate(new Date());
    const to = parseDateOnly(req.query.to, "to", today);
    const from = parseDateOnly(req.query.from, "from", shiftDate(to, -13));
    const dayCount = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1;
    if (from > to || !Number.isInteger(dayCount) || dayCount > 366) {
      const error = new Error("Date range must be ordered and no longer than 366 days");
      error.status = 400;
      throw error;
    }

    const platform = String(req.query.platform || "ALL").toUpperCase();
    if (!["ALL", "TELEGRAM", "LARK", "WHATSAPP"].includes(platform)) {
      const error = new Error("Invalid platform filter");
      error.status = 400;
      throw error;
    }

    let groupId = null;
    if (req.query.groupId !== undefined && req.query.groupId !== "ALL") {
      groupId = String(req.query.groupId);
      if (!/^[1-9]\d*$/.test(groupId)) {
        const error = new Error("groupId must be a positive integer");
        error.status = 400;
        throw error;
      }
    }

    const rows = await repository.getResponseTimeReportRows({
      fromStart: `${from}T00:00:00+07:00`,
      toEndExclusive: `${shiftDate(to, 1)}T00:00:00+07:00`,
      platform,
      groupId
    });
    const data = buildResponseTimeReport(rows, { from, to });
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function getSettings(req, res, next) {
  try {
    return res.json({ success: true, data: await repository.getPolicy() });
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const firstResponseMinutes = Number(req.body?.firstResponseMinutes);
    const reminderIntervalMinutes = Number(req.body?.reminderIntervalMinutes);
    const newSlaGapMinutes = Number(req.body?.newSlaGapMinutes);
    if (!Number.isInteger(firstResponseMinutes) || firstResponseMinutes < 1 || firstResponseMinutes > 240) {
      const error = new Error("First response time must be between 1 and 240 minutes");
      error.status = 400;
      throw error;
    }
    if (!Number.isInteger(reminderIntervalMinutes) || reminderIntervalMinutes < 1 || reminderIntervalMinutes > 240) {
      const error = new Error("Reminder interval must be between 1 and 240 minutes");
      error.status = 400;
      throw error;
    }
    if (!Number.isInteger(newSlaGapMinutes) || newSlaGapMinutes < 1 || newSlaGapMinutes > 240) {
      const error = new Error("New SLA gap must be between 1 and 240 minutes");
      error.status = 400;
      throw error;
    }
    const data = await repository.updatePolicy({ firstResponseMinutes, reminderIntervalMinutes, newSlaGapMinutes });
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getOverview,
  listSlas,
  getReport,
  getResponseTimeReport,
  getSettings,
  updateSettings
};
