const assert = require("node:assert/strict");

const { HealthController } = require("../dist/health/health.controller.js");

const controller = new HealthController();
const result = controller.getHealth();

assert.equal(result.ok, true);
assert.equal(result.service, "ai-call-handling-backend");
assert.equal(typeof result.timestamp, "string");

console.log("Smoke test passed");
