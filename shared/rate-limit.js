const buckets = new Map();

function createRateLimit({ windowMs = 60000, max = 120, name = "api" } = {}) {
  const safeWindowMs = Number.isSafeInteger(windowMs) && windowMs > 0 ? windowMs : 60000;
  const safeMax = Number.isSafeInteger(max) && max > 0 ? max : 120;
  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = `${name}:${req.ip || req.socket.remoteAddress || "unknown"}`;
    let bucket = buckets.get(key);
    if (!bucket && buckets.size >= 20000) {
      for (const [entry, value] of buckets) if (value.resetAt <= now) buckets.delete(entry);
      if (buckets.size >= 20000) {
        return res.status(429).json({ success: false, message: "Rate limit capacity reached" });
      }
    }
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + safeWindowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.set("RateLimit-Limit", String(safeMax));
    res.set("RateLimit-Remaining", String(Math.max(0, safeMax - bucket.count)));
    res.set("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > safeMax) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ success: false, message: "Too many requests" });
    }
    if (buckets.size > 10000) {
      for (const [entry, value] of buckets) if (value.resetAt <= now) buckets.delete(entry);
    }
    return next();
  };
}

module.exports = createRateLimit;
