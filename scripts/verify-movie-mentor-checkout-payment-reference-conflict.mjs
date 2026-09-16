import assert from "node:assert/strict";
import { createMovieMentorCommercialCheckoutBindingMongoStore } from "../ai/MovieMentorCommercialCheckoutBindingMongoStore.js";

console.log("Movie Mentor checkout payment reference conflict authority court");

const indexes = [
  { key: { commercialIntentId: 1 }, unique: true },
  { key: { provider: 1, checkoutReference: 1 }, unique: true, partialFilterExpression: { checkoutReference: { $type: "string" } } },
  { key: { provider: 1, providerPaymentReference: 1 }, unique: true, partialFilterExpression: { providerPaymentReference: { $type: "string" } } },
];

const rows = new Map([
  ["intent-a", {
    domain: "iband.movie-mentor.commercial-checkout-binding",
    schema: 1,
    commercialIntentId: "intent-a",
    provider: "provider-a",
    idempotencyKey: "key-a",
    status: "completed",
    checkoutReference: "checkout-a",
    checkoutUrl: "https://checkout.example/a",
    expiresAt: null,
    providerPaymentReference: "payment-shared",
    createdAtAuthority: new Date("2035-01-01T00:00:00.000Z"),
    completedAtAuthority: new Date("2035-01-01T00:01:00.000Z"),
    paymentBoundAtAuthority: new Date("2035-01-01T00:02:00.000Z"),
  }],
  ["intent-b", {
    domain: "iband.movie-mentor.commercial-checkout-binding",
    schema: 1,
    commercialIntentId: "intent-b",
    provider: "provider-a",
    idempotencyKey: "key-b",
    status: "completed",
    checkoutReference: "checkout-b",
    checkoutUrl: "https://checkout.example/b",
    expiresAt: null,
    providerPaymentReference: null,
    createdAtAuthority: new Date("2035-01-01T00:03:00.000Z"),
    completedAtAuthority: new Date("2035-01-01T00:04:00.000Z"),
    paymentBoundAtAuthority: null,
  }],
]);

let mutationCalls = 0;

function matches(row, filter) {
  for (const [key, expected] of Object.entries(filter)) {
    if (key === "$or") continue;
    if (row[key] !== expected) return false;
  }
  if (filter.$or) {
    const ok = filter.$or.some(condition => Object.entries(condition).every(([key, expected]) => row[key] === expected));
    if (!ok) return false;
  }
  return true;
}

function query(result) {
  return {
    lean() { return this; },
    async exec() { return result; },
  };
}

const modelRef = {
  async init() {},
  collection: { async indexes() { return indexes; } },
  findOne(filter) {
    const row = [...rows.values()].find(candidate => matches(candidate, filter));
    return query(row ? structuredClone(row) : null);
  },
  findOneAndUpdate(filter, update) {
    mutationCalls += 1;
    const row = [...rows.values()].find(candidate => matches(candidate, filter));
    if (!row) return query(null);
    const payment = update?.$set?.providerPaymentReference;
    if (payment && [...rows.values()].some(candidate => candidate !== row && candidate.provider === row.provider && candidate.providerPaymentReference === payment)) {
      return {
        lean() { return this; },
        async exec() { const error = new Error("E11000 duplicate key"); error.code = 11000; throw error; },
      };
    }
    Object.assign(row, update.$set || {});
    return query(structuredClone(row));
  },
};

const store = createMovieMentorCommercialCheckoutBindingMongoStore({ modelRef });

await assert.rejects(
  () => store.bindProviderPaymentReference({
    commercialIntentId: "intent-b",
    provider: "provider-a",
    checkoutReference: "checkout-b",
    providerPaymentReference: "payment-shared",
  }),
  error => error?.code === "MOVIE_MENTOR_CHECKOUT_PAYMENT_REFERENCE_CONFLICT",
);

assert.equal(mutationCalls, 1, "the real store must reach the durable payment-binding mutation");
const intentA = await store.resolve({ commercialIntentId: "intent-a" });
const intentB = await store.resolve({ commercialIntentId: "intent-b" });
assert.equal(intentA.providerPaymentReference, "payment-shared", "the original payment owner must remain unchanged");
assert.equal(intentB.providerPaymentReference, null, "the competing checkout must remain unbound");

console.log("PASS checkout payment reference conflict is fenced by durable unique payment identity");
