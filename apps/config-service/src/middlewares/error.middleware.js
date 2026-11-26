function errorMiddleware(err, req, res, next) {
  console.error(err);

  if (err.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "Channel connection already exists"
    });
  }

  const status =
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status < 500
      ? err.status
      : 500;

  return res.status(status).json({
    success: false,
    message:
      status === 500
        ? "Internal server error"
        : err.message
  });
}

module.exports = errorMiddleware;
