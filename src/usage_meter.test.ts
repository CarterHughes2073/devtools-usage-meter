import assert from "node:assert/strict";
import { recordEvent } from "./usage_meter.js";

const ledger = recordEvent({ customer_id: "team-7", kind: "build", units: 4, occurred_at: "2026-01-01T00:00:00.000Z" });
recordEvent({ customer_id: "team-7", kind: "release", units: 2, occurred_at: "2026-01-01T00:05:00.000Z" }, ledger);
assert.equal(ledger.get("team-7"), 6);
assert.throws(() => recordEvent({ customer_id: "team-7", kind: "build", units: 0, occurred_at: "2026-01-01T00:00:00.000Z" }));
console.log("usage decision test passed");
