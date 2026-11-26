const TIME_ZONE = "Asia/Ho_Chi_Minh";
const LOCAL_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const WORK_WINDOWS = [
  { key: "MORNING", label: "08:00–12:00", start: 8 * 60, end: 12 * 60 },
  { key: "AFTERNOON", label: "13:00–17:00", start: 13 * 60, end: 17 * 60 },
  { key: "EVENING", label: "18:00–23:00", start: 18 * 60, end: 23 * 60 }
];

function localParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const local = new Date(date.getTime() + LOCAL_OFFSET_MS);
  const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes() +
    local.getUTCSeconds() / 60 + local.getUTCMilliseconds() / 60000;
  return { dayStart, minute };
}

function timestampAt(dayStart, minute) {
  return new Date(dayStart + minute * MINUTE_MS - LOCAL_OFFSET_MS);
}

function isWithinSupportHours(value = new Date()) {
  const parts = localParts(value);
  return Boolean(parts && WORK_WINDOWS.some(window =>
    parts.minute >= window.start && parts.minute < window.end
  ));
}

function nextSupportStart(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = localParts(date);
  if (!parts) return null;
  if (isWithinSupportHours(date)) return date;

  const nextWindow = WORK_WINDOWS.find(window => window.start >= parts.minute);
  if (nextWindow) return timestampAt(parts.dayStart, nextWindow.start);
  return timestampAt(parts.dayStart + DAY_MS, WORK_WINDOWS[0].start);
}

function addSupportMinutes(value, minutes) {
  const start = value instanceof Date ? value : new Date(value);
  const amount = Number(minutes);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(amount) || amount < 0) return null;
  if (amount === 0) return start;

  let cursor = start;
  let remaining = amount;
  // Settings cap a single SLA interval at 240 minutes; this also permits dates far in the past.
  for (let guard = 0; guard < 10000 && remaining > 0; guard++) {
    const parts = localParts(cursor);
    if (!parts) return null;
    const window = WORK_WINDOWS.find(item => parts.minute >= item.start && parts.minute < item.end);
    if (!window) {
      const next = nextSupportStart(cursor);
      if (!next || next.getTime() <= cursor.getTime()) return null;
      cursor = next;
      continue;
    }

    const available = window.end - parts.minute;
    if (remaining < available) return timestampAt(parts.dayStart, parts.minute + remaining);
    remaining -= available;
    cursor = timestampAt(parts.dayStart, window.end);
    if (remaining === 0) return nextSupportStart(cursor);
  }
  return remaining === 0 ? cursor : null;
}

function cumulativeSupportMinutes(value) {
  const parts = localParts(value);
  if (!parts) return null;
  const minutesToday = WORK_WINDOWS.reduce(
    (sum, window) => sum + Math.max(0, Math.min(parts.minute, window.end) - window.start),
    0
  );
  return (parts.dayStart / DAY_MS) * 780 + minutesToday;
}

function supportMinutesBetween(start, end) {
  const startMinutes = cumulativeSupportMinutes(start);
  const endMinutes = cumulativeSupportMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes < startMinutes) return null;
  return endMinutes - startMinutes;
}

module.exports = {
  TIME_ZONE,
  WORK_WINDOWS,
  isWithinSupportHours,
  nextSupportStart,
  addSupportMinutes,
  supportMinutesBetween
};
