import assert from "node:assert/strict";
import { createMovieMentorCommercialCheckoutBindingMongoStore } from "../ai/MovieMentorCommercialCheckoutBindingMongoStore.js";

console.log("Movie Mentor unpaid completed checkout discovery court");

const DOMAIN = "iband.movie-mentor.commercial-checkout-binding";
const SCHEMA = 1;
const indexes = [
  { key: { commercialIntentId: 1 }, unique: true },
  { key: { provider: 1, checkoutReference: 1 }, unique: true, partialFilterExpression: { checkoutReference: { $type: "string" } } },
  { key: { provider: 1, providerPaymentReference: 1 }, unique: true, partialFilterExpression: { providerPaymentReference: { $type: "string" } } },
];
const at = new Date("2035-01-01T00:00:00.000Z");
const base = (id, status, payment) => ({
  domain: DOMAIN,
  schema: SCHEMA,
  commercialIntentId: id,
  provider: "stripe",
  idempotencyKey: `key-${id}`,
  status,
  checkoutReference: status === "completed" ? `cs-${id}` : null,
  checkoutUrl: status === "completed" ? `https://checkout.example/${id}` : null,
  expiresAt: null,
  providerPaymentReference: payment,
  createdAtAuthority: at,
  completedAtAuthority: status === "completed" ? at : null,
  paymentBoundAtAuthority: payment ? at : null,
});

const rows = [
  base("completed-null", "completed", null),
  base("completed-blank", "completed", ""),
  base("completed-paid", "completed", "pi-paid"),
  base("pending-null", "pending", null),
];
let findCalls = 0;
const matches = (row, filter) => {
  for (const [key, expected] of Object.entries(filter)) {
    if (key === "$or") {
      if (!expected.some(part => matches(row, part))) return false;
      continue;
    }
    if (row[key] !== expected) return false;
  }
  return true;
};
const query = value => ({ lean() { return this; }, async exec() { return value; } });
const modelRef = {
  async init() {},
  collection: { async indexes() { return indexes; } },
  find(filter) {
    findCalls += 1;
    return query(rows.filter(row => matches(row, filter)).map(row => structuredClone(row)));
  },
};

const store = createMovieMentorCommercialCheckoutBindingMongoStore({ modelRef });
const discovered = await store.listUnpaidCompleted();

assert.equal(findCalls, 1, "discovery must execute one durable store read");
assert.deepEqual(discovered.map(row => row.commercialIntentId).sort(), ["completed-blank", "completed-null"]);
for (const row of discovered) {
  assert.equal(row.status, "completed");
  assert.equal(row.providerPaymentReference, null);
}
assert.equal(discovered.some(row => row.commercialIntentId === "completed-paid"), false, "already-bound checkout must not be rediscovered as unpaid");
assert.equal(discovered.some(row => row.commercialIntentId === "pending-null"), false, "pending checkout must not be discovered as completed unpaid reality");

console.log("✓ real checkout binding store discovers only completed rows with absent provider payment identity");
console.log("✓ paid completed and still-pending checkout rows remain outside unpaid-completed discovery");
console.log("unpaid completed checkout discovery: GREEN");
