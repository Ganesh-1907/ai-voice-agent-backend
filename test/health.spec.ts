import assert from "node:assert/strict";
import test from "node:test";

import { HealthController } from "../src/health/health.controller";

test("HealthController returns a healthy payload", () => {
  const controller = new HealthController();
  const result = controller.getHealth();

  assert.equal(result.ok, true);
  assert.equal(result.service, "ai-call-handling-backend");
  assert.equal(typeof result.timestamp, "string");
});
