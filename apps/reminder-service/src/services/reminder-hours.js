const {
  isWithinSupportHours,
  nextSupportStart
} = require("../../../../shared/support-hours");

async function deferIfOutsideSupportHours(repository, jobId, now = new Date()) {
  if (isWithinSupportHours(now)) return false;
  const nextStart = nextSupportStart(now);
  if (!nextStart) throw new Error("Could not calculate next support window");
  await repository.deferJobUntil(jobId, nextStart);
  return true;
}

module.exports = { deferIfOutsideSupportHours };
