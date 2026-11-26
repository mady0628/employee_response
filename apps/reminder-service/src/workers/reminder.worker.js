const repository = require(
  "../repositories/reminder.repository"
);
const { processReminderJob } = require("../services/reminder.service");

const POLL_INTERVAL = Number(
  process.env.REMINDER_POLL_INTERVAL_MS || 5000
);

async function runOnce() {
  const job = await repository.claimNextJob();
  if (!job) return;

  console.log(
    `Processing reminder job ${job.id}, attempt ${job.attempts}`
  );

  try {
    const result = await processReminderJob(job);
    console.log(
      `Reminder job ${job.id}:`,
      result
    );
  } catch (error) {
    console.error(
      `Reminder job ${job.id} failed:`,
      error.message
    );
    await repository.failJob(job.id, error.message);
  }
}

function startReminderWorker() {
  let running = false;

  const timer = setInterval(async () => {
    if (running) return;

    running = true;

    try {
      await repository.recoverStaleJobs();
      await repository.cleanupCancelledJobs();
      await runOnce();
    } catch (error) {
      console.error(
        "Reminder worker error:",
        error.message
      );
    } finally {
      running = false;
    }
  }, POLL_INTERVAL);

  console.log("Reminder Worker started");
  return timer;
}

module.exports = { startReminderWorker, runOnce };
