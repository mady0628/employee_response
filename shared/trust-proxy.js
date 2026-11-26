function configureTrustProxy(app) {
  const raw = process.env.TRUST_PROXY_HOPS || "0";
  if (!/^[0-5]$/.test(raw)) {
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 5");
  }
  app.set("trust proxy", Number(raw));
}

module.exports = configureTrustProxy;
