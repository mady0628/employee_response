const {
  TIME_ZONE,
  WORK_WINDOWS,
  supportMinutesBetween
} = require("../../../../shared/support-hours");
const LOCAL_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const RESPONSE_THRESHOLDS = [1, 3, 5, 10, 30, 60];

function localParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const local = new Date(date.getTime() + LOCAL_OFFSET_MS);
  const day = Math.floor(Date.UTC(
    local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()
  ) / DAY_MS);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes() +
    local.getUTCSeconds() / 60 + local.getUTCMilliseconds() / 60000;
  return { day, minute, local };
}

function responseSlaMinutes(start, end) {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  if (
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime()) ||
    endDate < startDate
  ) return null;

  const endParts = localParts(endDate);
  const answeredDuringSupport = WORK_WINDOWS.some(window =>
    endParts.minute >= window.start && endParts.minute < window.end
  );
  if (!answeredDuringSupport) {
    return (endDate.getTime() - startDate.getTime()) / 60000;
  }
  return supportMinutesBetween(startDate, endDate);
}

function hourFor(value) {
  const parts = localParts(value);
  if (!parts) return null;
  const hour = Math.floor(parts.minute / 60);
  const key = String(hour).padStart(2, "0");
  return {
    key,
    label: key + ":00–" + String((hour + 1) % 24).padStart(2, "0") + ":00",
    order: hour
  };
}

function isReactionResponse(row) {
  return String(row.response_method || "").startsWith("REACTION");
}

function roundOne(value) {
  return value === null || value === undefined ? null : Math.round(value * 10) / 10;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return roundOne(sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2);
}

function percentage(numerator, denominator) {
  return denominator ? roundOne((numerator / denominator) * 100) : null;
}

function summarize(rows) {
  const nonCancelled = rows.filter(row => row.status !== "CANCELLED");
  const responded = nonCancelled.filter(row => row.status === "RESPONDED" && row.responded_at);
  const textResponded = responded.filter(row => !isReactionResponse(row));
  const waiting = nonCancelled.filter(row => row.status === "WAITING");
  const getSlaMinutes = row => responseSlaMinutes(
    row.waiting_started_at,
    row.responded_at || row.report_as_of
  );
  const textDurations = textResponded.map(getSlaMinutes).filter(Number.isFinite);
  const allDurations = responded.map(getSlaMinutes).filter(Number.isFinite);
  const allWallDurations = responded.map(row => {
    const elapsed = new Date(row.responded_at).getTime() - new Date(row.waiting_started_at).getTime();
    return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed / 60000 : null;
  }).filter(Number.isFinite);

  const thresholds = RESPONSE_THRESHOLDS.map(minutes => {
    const textCount = textResponded.filter(row => {
      const duration = getSlaMinutes(row);
      return Number.isFinite(duration) && duration <= minutes;
    }).length;
    const includingReactionsCount = responded.filter(row => {
      const duration = getSlaMinutes(row);
      return Number.isFinite(duration) && duration <= minutes;
    }).length;
    return {
      minutes,
      textCount,
      textRate: percentage(textCount, nonCancelled.length),
      includingReactionsCount,
      includingReactionsRate: percentage(includingReactionsCount, nonCancelled.length)
    };
  });

  const waitingOver30TextOnly = nonCancelled.filter(row => {
    const notAnsweredWithText = row.status === "WAITING" ||
      (row.status === "RESPONDED" && isReactionResponse(row));
    const duration = row.status === "WAITING"
      ? supportMinutesBetween(row.waiting_started_at, row.report_as_of)
      : getSlaMinutes(row);
    return notAnsweredWithText && Number.isFinite(duration) && duration > 30;
  }).length;
  const waitingOver30IncludingReactions = waiting.filter(
    row => {
      const duration = supportMinutesBetween(row.waiting_started_at, row.report_as_of);
      return Number.isFinite(duration) && duration > 30;
    }
  ).length;

  return {
    totalInquiries: rows.length,
    eligibleInquiries: nonCancelled.length,
    cancelled: rows.length - nonCancelled.length,
    answeredByText: textResponded.length,
    answeredIncludingReactions: responded.length,
    waiting: waiting.length,
    waitingOver30TextOnly,
    waitingOver30IncludingReactions,
    medianResponseSlaMinutesTextOnly: median(textDurations),
    medianResponseSlaMinutesIncludingReactions: median(allDurations),
    medianWallMinutesTextOnly: median(textResponded.map(row =>
      (new Date(row.responded_at).getTime() - new Date(row.waiting_started_at).getTime()) / 60000
    ).filter(value => Number.isFinite(value) && value >= 0)),
    medianWallMinutesIncludingReactions: median(allWallDurations),
    thresholds
  };
}

function buildResponseTimeReport(rows, { from, to, reportAsOf = new Date() }) {
  const reportAsOfValue = reportAsOf instanceof Date ? reportAsOf : new Date(reportAsOf);
  const prepared = rows.map(row => ({
    ...row,
    conversation_id: String(row.conversation_id),
    report_as_of: reportAsOfValue,
    hour: hourFor(row.waiting_started_at)
  }));

  const byHour = Array.from({ length: 24 }, (_, hour) => {
    const key = String(hour).padStart(2, "0");
    return {
      key,
      label: key + ":00–" + String((hour + 1) % 24).padStart(2, "0") + ":00",
      ...summarize(prepared.filter(row => row.hour?.key === key))
    };
  });

  const groupMap = new Map();
  for (const row of prepared) {
    const key = row.conversation_id;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        conversationId: key,
        groupName: row.group_name || row.external_chat_id,
        platform: row.platform,
        rows: []
      });
    }
    groupMap.get(key).rows.push(row);
  }
  const byGroup = [...groupMap.values()]
    .map(group => ({
      conversationId: group.conversationId,
      groupName: group.groupName,
      platform: group.platform,
      ...summarize(group.rows)
    }))
    .sort((a, b) => b.totalInquiries - a.totalInquiries || a.groupName.localeCompare(b.groupName));

  const dayMap = new Map();
  for (const row of prepared) {
    const parts = localParts(row.waiting_started_at);
    const day = parts.local.toISOString().slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day).push(row);
  }
  const byDay = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayRows]) => ({ day, ...summarize(dayRows) }));

  return {
    from,
    to,
    timeZone: TIME_ZONE,
    workWindows: WORK_WINDOWS.slice(0, 3).map(({ key, label }) => ({ key, label })),
    thresholds: RESPONSE_THRESHOLDS,
    summary: summarize(prepared),
    byHour,
    byGroup,
    byDay
  };
}

module.exports = {
  buildResponseTimeReport,
  responseSlaMinutes,
  supportMinutesBetween,
  hourFor
};
