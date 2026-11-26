function validateProductionEnv(keys) {
  if (process.env.NODE_ENV !== "production") return;
  const invalid = keys.filter(key => {
    const value = process.env[key];
    const isSecret = /PASSWORD|API_KEY|TOKEN|SECRET|ENCRYPTION_KEY/i.test(key);
    return !value || value.includes("REPLACE_") || (isSecret && value.length < 32);
  });
  if (invalid.length) {
    throw new Error(`Missing, placeholder, or weak production secrets/configuration: ${invalid.join(", ")}`);
  }
}

module.exports = validateProductionEnv;
