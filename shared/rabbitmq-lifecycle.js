function superviseRabbitConnection(connection, name) {
  connection.on("error", error => {
    console.error(`[RabbitMQ:${name}] connection error:`, error.message);
  });

  connection.on("close", () => {
    console.error(`[RabbitMQ:${name}] connection closed`);
    // Let Docker restart the production container and nodemon restart local
    // development services instead of leaving consumers alive with dead channels.
    const timer = setTimeout(() => process.exit(1), 100);
    timer.unref?.();
  });
}

module.exports = { superviseRabbitConnection };
