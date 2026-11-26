let installed = false;

function installFatalProcessHandlers(serviceName = process.env.SERVICE_NAME || "service") {
  if (installed) return;
  installed = true;

  process.on("uncaughtException", error => {
    console.error(`[${serviceName}] Uncaught exception; exiting`, error);
    process.exit(1);
  });

  process.on("unhandledRejection", reason => {
    console.error(`[${serviceName}] Unhandled promise rejection; exiting`, reason);
    process.exit(1);
  });
}

module.exports = installFatalProcessHandlers;
