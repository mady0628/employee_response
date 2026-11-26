const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const testFiles = fs.readdirSync(__dirname)
  .filter(name => name.endsWith(".test.js"))
  .sort()
  .map(name => path.join(__dirname, name));

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
  windowsHide: true
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
